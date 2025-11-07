const winston = require('winston');
const config = require('../../config/default');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.colorize({ all: true })
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),
  ],
});

// If we're not in production then log to the console with colors
if (config.server.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        let metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      }),
      winston.format.colorize({ all: true })
    )
  }));
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add custom logging methods for business metrics
logger.request = (message, meta = {}) => {
  logger.info(`REQUEST: ${message}`, { ...meta, logType: 'request' });
};

logger.performance = (message, meta = {}) => {
  logger.info(`PERFORMANCE: ${message}`, { ...meta, logType: 'performance' });
};

logger.security = (message, meta = {}) => {
  logger.warn(`SECURITY: ${message}`, { ...meta, logType: 'security' });
};

logger.business = (message, meta = {}) => {
  logger.info(`BUSINESS: ${message}`, { ...meta, logType: 'business' });
};

module.exports = logger;
