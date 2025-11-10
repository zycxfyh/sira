const { logger } = require('..\..srccorelogger');

#!/usr/bin/env node

/**
 * Sira AI Gateway - Health Check Script
 * This script performs basic health checks on the project
 */

const fs = require('node:fs');
const { execSync } = require('node:child_process');

logger.info('🔍 Performing Sira AI Gateway Health Check...');
logger.info('==============================================');

// Check Node.js version
logger.info('📦 Checking Node.js version...');
try {
  const nodeVersion = process.version.replace('v', '');
  const requiredVersion = '18.0.0';

  if (compareVersions(nodeVersion, requiredVersion) >= 0) {
    logger.info(`✅ Node.js version: ${nodeVersion} (✓ meets requirement >= ${requiredVersion})`);
  } else {
    logger.info(`❌ Node.js version: ${nodeVersion} (✗ requires >= ${requiredVersion})`);
    process.exit(1);
  }
} catch (_error) {
  logger.info('❌ Unable to check Node.js version');
  process.exit(1);
}

// Check npm
logger.info('📦 Checking npm...');
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  logger.info(`✅ npm version: ${npmVersion}`);
} catch (_error) {
  logger.info('❌ npm not found');
  process.exit(1);
}

// Check project structure
logger.info('🏗️  Checking project structure...');

// Required directories
const requiredDirs = [
  'src/core',
  'src/config',
  'src/test',
  'docs',
  'scripts/utilities',
  'infrastructure',
  '.github/workflows',
];

for (const dir of requiredDirs) {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    logger.info(`✅ Directory exists: ${dir}`);
  } else {
    logger.info(`❌ Directory missing: ${dir}`);
    process.exit(1);
  }
}

// Required files
const requiredFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  '.gitignore',
  '.github/workflows/ci.yml',
  'src/core/index.js',
  'src/config/gateway.config.yml',
];

for (const file of requiredFiles) {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    logger.info(`✅ File exists: ${file}`);
  } else {
    logger.info(`❌ File missing: ${file}`);
    process.exit(1);
  }
}

// Check package.json validity
logger.info('📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.scripts?.test) {
    logger.info('✅ package.json has test script');
  } else {
    logger.info('⚠️  package.json missing test script');
  }
} catch (_error) {
  logger.info('❌ package.json is invalid JSON');
  process.exit(1);
}

// Check for common security issues
logger.info('🔒 Checking for security issues...');
const envFiles = [
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local',
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    logger.info(`⚠️  ${envFile} file found - ensure it's not committed`);
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      if (content.match(/password|secret|key/i)) {
        logger.info(`⚠️  Sensitive data found in ${envFile}`);
      }
    } catch (_error) {
      // Ignore read errors
    }
  }
}

// Check git status
logger.info('📝 Checking git status...');
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
  const stagedChanges = gitStatus.split('n').filter(line => line && !line.startsWith('??'));

  if (stagedChanges.length > 0) {
    logger.info('⚠️  There are staged/uncommitted changes');
  } else {
    logger.info('✅ Git working directory is clean');
  }
} catch (_error) {
  logger.info('⚠️  Not a git repository or git not available');
}

logger.info('');
logger.info('🎉 Health check completed successfully!');
logger.info('==============================================');
logger.info('📊 Summary:');
logger.info('   ✅ Project structure is valid');
logger.info('   ✅ Required dependencies are available');
logger.info('   ✅ Configuration files are present');
logger.info('');
logger.info('🚀 Ready for development and deployment!');

// Helper function to compare versions
function compareVersions(version1, version2) {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}
