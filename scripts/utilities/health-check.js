#!/usr/bin/env node

/**
 * Sira AI Gateway - Health Check Script
 * This script performs basic health checks on the project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Performing Sira AI Gateway Health Check...');
console.log('==============================================');

// Check Node.js version
console.log('📦 Checking Node.js version...');
try {
  const nodeVersion = process.version.replace('v', '');
  const requiredVersion = '18.0.0';

  if (compareVersions(nodeVersion, requiredVersion) >= 0) {
    console.log(`✅ Node.js version: ${nodeVersion} (✓ meets requirement >= ${requiredVersion})`);
  } else {
    console.log(`❌ Node.js version: ${nodeVersion} (✗ requires >= ${requiredVersion})`);
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Unable to check Node.js version');
  process.exit(1);
}

// Check npm
console.log('📦 Checking npm...');
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm version: ${npmVersion}`);
} catch (error) {
  console.log('❌ npm not found');
  process.exit(1);
}

// Check project structure
console.log('🏗️  Checking project structure...');

// Required directories
const requiredDirs = [
  'src/core',
  'src/config',
  'src/test',
  'docs',
  'scripts/utilities',
  'infrastructure',
  '.github/workflows'
];

for (const dir of requiredDirs) {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    console.log(`✅ Directory exists: ${dir}`);
  } else {
    console.log(`❌ Directory missing: ${dir}`);
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
  'src/config/gateway.config.yml'
];

for (const file of requiredFiles) {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    console.log(`✅ File exists: ${file}`);
  } else {
    console.log(`❌ File missing: ${file}`);
    process.exit(1);
  }
}

// Check package.json validity
console.log('📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.scripts && packageJson.scripts.test) {
    console.log('✅ package.json has test script');
  } else {
    console.log('⚠️  package.json missing test script');
  }
} catch (error) {
  console.log('❌ package.json is invalid JSON');
  process.exit(1);
}

// Check for common security issues
console.log('🔒 Checking for security issues...');
const envFiles = ['.env', '.env.local', '.env.development.local', '.env.test.local', '.env.production.local'];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    console.log(`⚠️  ${envFile} file found - ensure it\'s not committed`);
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      if (content.match(/password|secret|key/i)) {
        console.log(`⚠️  Sensitive data found in ${envFile}`);
      }
    } catch (error) {
      // Ignore read errors
    }
  }
}

// Check git status
console.log('📝 Checking git status...');
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
  const stagedChanges = gitStatus.split('\n').filter(line => line && !line.startsWith('??'));

  if (stagedChanges.length > 0) {
    console.log('⚠️  There are staged/uncommitted changes');
  } else {
    console.log('✅ Git working directory is clean');
  }
} catch (error) {
  console.log('⚠️  Not a git repository or git not available');
}

console.log('');
console.log('🎉 Health check completed successfully!');
console.log('==============================================');
console.log('📊 Summary:');
console.log('   ✅ Project structure is valid');
console.log('   ✅ Required dependencies are available');
console.log('   ✅ Configuration files are present');
console.log('');
console.log('🚀 Ready for development and deployment!');

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
