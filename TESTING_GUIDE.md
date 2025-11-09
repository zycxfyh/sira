# Testing Guide - Sira AI Gateway

**Following GitHub Best Practices for Testing**

This guide helps you understand and run tests for the Sira AI Gateway project.

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Test Types](#-test-types)
- [Running Tests](#-running-tests)
- [Known Issues](#-known-issues)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all unit tests (recommended for development)
npm test

# Run specific test types
npm run test:unit        # Unit tests only
npm run test:services    # Service layer tests
npm run test:policies    # Policy tests
npm run test:e2e         # End-to-end tests (slower)
```

---

## 📊 Test Types

### 1. Unit Tests ⚡

**Location**: `src/test/unit/`  
**Speed**: Fast (~2-5s)  
**Purpose**: Test individual functions and components

```bash
npm run test:unit
```

### 2. Service Tests 🔧

**Location**: `src/test/services/`  
**Speed**: Medium (~5-10s)  
**Purpose**: Test service layer logic

```bash
npm run test:services
```

### 3. Policy Tests 🛡️

**Location**: `src/test/policies/`  
**Speed**: Medium (~5-10s)  
**Purpose**: Test gateway policies (auth, rate-limit, etc.)

```bash
npm run test:policies
```

### 4. Integration Tests 🔗

**Location**: `src/test/integration/`  
**Speed**: Medium-Slow (~10-20s)  
**Purpose**: Test component interactions

```bash
npm run test:integration
```

### 5. E2E Tests 🌐

**Location**: `src/test/e2e/`  
**Speed**: Slow (~30-60s)  
**Purpose**: Test complete user workflows

```bash
npm run test:e2e
```

**Note**: E2E tests require Gateway startup, which takes 5-15 seconds.

### 6. Contract Tests 📝

**Location**: `src/test/contract/`  
**Speed**: Medium (~10s)  
**Purpose**: Test API contracts

```bash
npm run test:contract
```

---

## 🏃 Running Tests

### Development Workflow (GitHub Best Practice)

```bash
# 1. Run quick unit tests during development
npm test

# 2. Before committing, run affected tests
npm run test:services
npm run test:policies

# 3. Before pushing, run full test suite (excluding E2E)
npm run test:all

# 4. CI will run E2E tests automatically
```

### Running Specific Tests

```bash
# Run a specific test file
npm test -- --testPathPattern="users.test"

# Run tests matching a pattern
npm test -- --testPathPattern="policies/(log|expression)"

# Run with verbose output
npm test -- --verbose

# Run with coverage
npm run test:coverage
```

### Watch Mode (for TDD)

```bash
# Watch mode for unit tests
npm run test:watch

# Watch a specific file
npm test -- --watch --testPathPattern="users.test"
```

---

## ⚠️ Known Issues

### 1. CLI Tests Failing (yeoman-test)

**Issue**: CLI tests fail with "Cannot find module 'yeoman-test'" or ES module errors.

**Status**: 🟡 Workaround Available

**Root Cause**:

- `yeoman-test@7.x` uses ES modules
- Project uses CommonJS
- Version compatibility issues with `yeoman-environment@3.x`

**Workaround**:

```bash
# Skip CLI tests for now
npm test -- --testPathIgnorePatterns="cli"
```

**Permanent Fix** (planned for v2.1.0):

- Upgrade to `yeoman-environment@4.x`
- Or migrate CLI tests to use a different testing approach

### 2. E2E Tests Timeout

**Issue**: E2E tests timeout during Gateway startup.

**Status**: ✅ Fixed (as of Nov 9, 2025)

**Solution Applied**:

- Implemented retry-based health check
- Increased timeout to 60 seconds
- Added proper cleanup logic

### 3. Module Import Errors

**Issue**: "Cannot find module '../../../src/core/..."

**Status**: ✅ Fixed

**Solution**: Corrected relative import paths in test files.

---

## 🎯 Best Practices

### 1. Test Isolation (GitHub Best Practice)

```javascript
describe('My Test Suite', () => {
  let testData;

  beforeEach(() => {
    // Setup fresh data for each test
    testData = createTestData();
  });

  afterEach(() => {
    // Clean up after each test
    jest.clearAllMocks();
  });

  test('should do something', () => {
    // Test uses isolated testData
  });
});
```

### 2. Async Test Handling

```javascript
// ✅ Good: Using async/await
test('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// ✅ Good: Using done callback
test('should call callback', done => {
  fetchData((err, data) => {
    expect(data).toBeDefined();
    done(err);
  });
});

// ❌ Bad: Not handling async properly
test('should fetch data', () => {
  fetchData().then(data => {
    expect(data).toBeDefined(); // This might not run!
  });
});
```

### 3. Resource Cleanup

```javascript
describe('E2E Tests', () => {
  let server;
  let gatewayProcess;

  afterAll(async () => {
    // GitHub Best Practice: Safe cleanup with null checks
    if (gatewayProcess && typeof gatewayProcess.kill === 'function') {
      gatewayProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (server && typeof server.close === 'function') {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
```

### 4. Test Naming

```javascript
// ✅ Good: Descriptive test names
test('should return 401 when API key is missing', () => {});
test('should rate limit after 100 requests per minute', () => {});

// ❌ Bad: Vague test names
test('test1', () => {});
test('should work', () => {});
```

### 5. Mocking External Dependencies

```javascript
// Mock Redis for faster tests
jest.mock('ioredis', () => require('ioredis-mock'));

// Mock external API calls
jest.mock('superagent', () => ({
  get: jest.fn().mockResolvedValue({ body: { data: 'mocked' } }),
}));
```

---

## 🔧 Troubleshooting

### Tests Hanging

**Symptom**: Tests don't complete, Jest hangs

**Solutions**:

```bash
# 1. Check for open handles
npm test -- --detectOpenHandles

# 2. Force exit after tests
# (Already configured in jest.config.js)

# 3. Kill any hanging processes
# Windows:
taskkill /F /IM node.exe /T

# Linux/Mac:
pkill -f node
```

### Module Not Found Errors

**Symptom**: "Cannot find module 'xxx'"

**Solutions**:

```bash
# 1. Clear Jest cache
npx jest --clearCache

# 2. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Check if module is installed
npm list <module-name>
```

### Timeout Errors

**Symptom**: "Exceeded timeout of 5000ms"

**Solutions**:

```javascript
// Option 1: Increase timeout for specific test
test('slow test', async () => {
  // test code
}, 30000); // 30 seconds

// Option 2: Increase timeout for all tests in suite
describe('Slow Suite', () => {
  jest.setTimeout(30000);

  test('test 1', () => {});
});

// Option 3: Set timeout in jest.config.js (already done)
```

### Port Already in Use

**Symptom**: "EADDRINUSE: address already in use"

**Solutions**:

```bash
# Windows: Find and kill process using port
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:8080 | xargs kill -9
```

### Memory Issues

**Symptom**: "JavaScript heap out of memory"

**Solutions**:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm test

# Or run tests in smaller batches
npm test -- --maxWorkers=2
```

---

## 📈 Test Coverage

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Goals

| Component    | Target | Current        |
| ------------ | ------ | -------------- |
| Core Gateway | >80%   | 🎯 In Progress |
| Policies     | >75%   | 🎯 In Progress |
| Services     | >70%   | 🎯 In Progress |
| Overall      | >70%   | 🎯 In Progress |

---

## 🚦 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

```bash
# Install husky (already configured)
npm install

# Pre-commit will automatically run:
# - Linting
# - Unit tests
# - Format check
```

---

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [ERROR_REPORT.md](./ERROR_REPORT.md) - Detailed error analysis
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) - Known testing issues
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines

---

## 🤝 Contributing Tests

When contributing tests, please:

1. ✅ Follow existing test patterns
2. ✅ Write descriptive test names
3. ✅ Include both positive and negative test cases
4. ✅ Clean up resources in `afterEach`/`afterAll`
5. ✅ Keep tests fast and isolated
6. ✅ Mock external dependencies
7. ✅ Add comments for complex test logic

### Example Test Template

```javascript
const { createTestUser } = require('../helpers');

describe('User Service', () => {
  let userService;
  let testUser;

  beforeEach(() => {
    userService = new UserService();
    testUser = createTestUser();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    test('should create user with valid data', async () => {
      const result = await userService.createUser(testUser);

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.username).toBe(testUser.username);
    });

    test('should reject user with invalid email', async () => {
      testUser.email = 'invalid-email';

      await expect(userService.createUser(testUser)).rejects.toThrow(
        'Invalid email format'
      );
    });
  });
});
```

---

## 📞 Getting Help

- **Issues**: [GitHub Issues](https://github.com/zycxfyh/sira/issues)
- **Discussions**: [GitHub Discussions](https://github.com/zycxfyh/sira/discussions)
- **Documentation**: [docs/](./docs/)

---

**Last Updated**: November 9, 2025  
**Maintainer**: Sira Development Team
