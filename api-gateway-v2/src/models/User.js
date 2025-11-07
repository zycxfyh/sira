const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  // API usage limits and quotas
  quota: {
    requestsPerHour: {
      type: Number,
      default: 1000
    },
    requestsPerDay: {
      type: Number,
      default: 10000
    },
    tokensPerMonth: {
      type: Number,
      default: 1000000
    },
    costLimitPerMonth: {
      type: Number,
      default: 100.0 // CNY
    }
  },
  // API Keys
  apiKeys: [{
    key: {
      type: String,
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    permissions: [{
      type: String,
      enum: ['read', 'write', 'admin']
    }]
  }],
  // Usage statistics
  usage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0.0
    },
    requestsThisHour: {
      type: Number,
      default: 0
    },
    requestsThisDay: {
      type: Number,
      default: 0
    },
    tokensThisMonth: {
      type: Number,
      default: 0
    },
    costThisMonth: {
      type: Number,
      default: 0.0
    },
    lastRequestAt: Date
  },
  // Preferences
  preferences: {
    defaultModel: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    defaultTemperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2
    },
    maxTokens: {
      type: Number,
      default: 1000,
      min: 1,
      max: 4000
    },
    notificationEmail: {
      type: Boolean,
      default: true
    },
    costAlerts: {
      type: Boolean,
      default: true
    }
  },
  // Profile information
  profile: {
    firstName: String,
    lastName: String,
    company: String,
    website: String,
    avatar: String
  },
  // Security
  security: {
    lastLoginAt: Date,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'apiKeys.key': 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate API key
userSchema.methods.generateApiKey = function(name, permissions = ['read', 'write']) {
  const crypto = require('crypto');
  const key = `agv2_${crypto.randomBytes(32).toString('hex')}`;

  this.apiKeys.push({
    key,
    name,
    permissions
  });

  return key;
};

// Method to validate API key
userSchema.methods.validateApiKey = function(apiKey) {
  const keyDoc = this.apiKeys.find(k => k.key === apiKey && k.isActive);
  if (keyDoc) {
    keyDoc.lastUsed = new Date();
    return keyDoc;
  }
  return null;
};

// Method to check quota
userSchema.methods.checkQuota = function(requestType = 'request') {
  const now = new Date();

  // Reset counters if needed
  if (this.usage.lastRequestAt) {
    const lastRequest = new Date(this.usage.lastRequestAt);
    const hoursDiff = (now - lastRequest) / (1000 * 60 * 60);

    if (hoursDiff >= 1) {
      this.usage.requestsThisHour = 0;
    }

    const daysDiff = (now - lastRequest) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 1) {
      this.usage.requestsThisDay = 0;
    }

    const monthsDiff = this.getMonthsDiff(lastRequest, now);
    if (monthsDiff >= 1) {
      this.usage.tokensThisMonth = 0;
      this.usage.costThisMonth = 0.0;
    }
  }

  // Check limits
  if (requestType === 'request') {
    if (this.usage.requestsThisHour >= this.quota.requestsPerHour) {
      throw new Error('Hourly request limit exceeded');
    }
    if (this.usage.requestsThisDay >= this.quota.requestsPerDay) {
      throw new Error('Daily request limit exceeded');
    }
  }

  return true;
};

// Method to update usage
userSchema.methods.updateUsage = function(tokens = 0, cost = 0.0) {
  this.usage.totalRequests += 1;
  this.usage.totalTokens += tokens;
  this.usage.totalCost += cost;
  this.usage.requestsThisHour += 1;
  this.usage.requestsThisDay += 1;
  this.usage.tokensThisMonth += tokens;
  this.usage.costThisMonth += cost;
  this.usage.lastRequestAt = new Date();

  // Check monthly limits
  if (this.usage.tokensThisMonth > this.quota.tokensPerMonth) {
    throw new Error('Monthly token limit exceeded');
  }
  if (this.usage.costThisMonth > this.quota.costLimitPerMonth) {
    throw new Error('Monthly cost limit exceeded');
  }
};

// Helper method to calculate months difference
userSchema.methods.getMonthsDiff = function(date1, date2) {
  return date2.getMonth() - date1.getMonth() +
         (12 * (date2.getFullYear() - date1.getFullYear()));
};

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to find user by API key
userSchema.statics.findByApiKey = function(apiKey) {
  return this.findOne({
    'apiKeys.key': apiKey,
    'apiKeys.isActive': true,
    status: 'active'
  });
};

module.exports = mongoose.model('User', userSchema);
