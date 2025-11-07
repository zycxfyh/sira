const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Authenticate user via JWT token or API key
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;
    let user = null;

    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        user = await User.findById(decoded.userId);
      } catch (jwtError) {
        // JWT invalid, continue to check API key
      }
    }

    // Check for API key in header or query parameter
    if (!user) {
      const apiKey = req.headers['x-api-key'] || req.query.api_key;
      if (apiKey) {
        user = await User.findByApiKey(apiKey);
        if (user) {
          // Validate API key permissions
          const keyDoc = user.validateApiKey(apiKey);
          req.apiKeyPermissions = keyDoc.permissions;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid JWT token or API key'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account is not active'
      });
    }

    // Attach user to request
    req.user = user;

    // Update last request time
    user.security.lastLoginAt = new Date();
    await user.save();

    next();
  } catch (error) {
    logger.error('Authentication error', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Admin access required'
    });
  }

  next();
};

/**
 * Require super admin role
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Super admin access required'
    });
  }

  next();
};

/**
 * Check quota limits
 */
const checkQuota = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    // Check quota limits
    req.user.checkQuota('request');

    next();
  } catch (error) {
    return res.status(429).json({
      error: 'Quota exceeded',
      message: error.message
    });
  }
};

/**
 * Update usage statistics
 */
const updateUsage = (tokens = 0, cost = 0.0) => {
  return async (req, res, next) => {
    // Store original send method
    const originalSend = res.send;

    // Override send method to capture response
    res.send = function(data) {
      // Restore original send method
      res.send = originalSend;

      try {
        // Update usage if user exists
        if (req.user) {
          req.user.updateUsage(tokens, cost);
          req.user.save().catch(error => {
            logger.error('Failed to update usage', error);
          });
        }
      } catch (error) {
        logger.error('Usage update error', error);
      }

      // Call original send method
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Login user and generate token
 */
const login = async (identifier, password) => {
  // Find user by email or username
  const user = await User.findOne({
    $or: [
      { email: identifier },
      { username: identifier }
    ]
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check password
  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    // Increment login attempts
    user.security.loginAttempts += 1;

    // Lock account after 5 failed attempts
    if (user.security.loginAttempts >= 5) {
      user.security.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    }

    await user.save();
    throw new Error('Invalid credentials');
  }

  // Check if account is locked
  if (user.security.lockUntil && user.security.lockUntil > Date.now()) {
    throw new Error('Account is temporarily locked due to too many failed login attempts');
  }

  // Reset login attempts on successful login
  user.security.loginAttempts = 0;
  user.security.lockUntil = undefined;
  user.security.lastLoginAt = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id);

  return { user, token };
};

/**
 * Register new user
 */
const register = async (userData) => {
  const { username, email, password, ...otherData } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [
      { email },
      { username }
    ]
  });

  if (existingUser) {
    throw new Error('User with this email or username already exists');
  }

  // Create new user
  const user = new User({
    username,
    email,
    password,
    ...otherData
  });

  await user.save();

  // Generate token
  const token = generateToken(user._id);

  return { user, token };
};

module.exports = {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  checkQuota,
  updateUsage,
  generateToken,
  verifyToken,
  login,
  register
};
