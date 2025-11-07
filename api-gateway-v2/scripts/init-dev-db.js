// MongoDB initialization script for development
db = db.getSiblingDB('api-gateway-dev');

// Create collections with indexes
db.createCollection('users');
db.createCollection('apikeys');
db.createCollection('requests');
db.createCollection('metrics');

// Create indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "createdAt": -1 });

db.apikeys.createIndex({ "key": 1 }, { unique: true });
db.apikeys.createIndex({ "userId": 1 });
db.apikeys.createIndex({ "lastUsed": -1 });

db.requests.createIndex({ "userId": 1 });
db.requests.createIndex({ "timestamp": -1 });
db.requests.createIndex({ "model": 1 });

db.metrics.createIndex({ "timestamp": -1 });
db.metrics.createIndex({ "type": 1 });

// Create default admin user
db.users.insertOne({
  username: 'admin',
  email: 'admin@example.com',
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeU8M0qOVTmMQ8tCe', // password: admin123
  role: 'superadmin',
  status: 'active',
  quota: {
    requestsPerHour: 10000,
    requestsPerDay: 100000,
    tokensPerMonth: 10000000,
    costLimitPerMonth: 1000.0
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Development database initialized successfully');
