module.exports = {
  testEnvironment: "node",
  testMatch: ["**/src/test/**/*.test.js"],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  clearMocks: true,
  collectCoverageFrom: [
    "src/server.js",
    "src/ai-client.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
};
