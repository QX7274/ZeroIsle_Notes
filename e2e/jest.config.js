module.exports = {
  testMatch: ['**/*.test.js'],
  testTimeout: 120000,
  reporters: ['detox/runners/jest/reporter'],
  setupFilesAfterEnv: ['detox/runners/jest/setup'],
};
