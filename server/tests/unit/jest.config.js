module.exports = {
  preset: "@vue/cli-plugin-unit-jest/presets/typescript-and-babel",
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
    'vue',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },
  rootDir: "../..",
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/tests/unit/**/*.spec.(js|ts)|**/__tests__/*.(js|ts)'],
  testURL: 'http://localhost/',
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  // collectCoverage: true,
  coverageReporters: [
    "text-summary",
    "text",
    "json",
    "html",
  ],
  collectCoverageFrom: [
    '**/*.{js,ts}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.config.js',
    '!**/*.eslintrc.js',
    '!**/config/**',
    '!**/migrations/**',
    '!**/models/**',
    '!**/seeders/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!**/src/**',
    '!app.js',
  ],
  setupFilesAfterEnv: ['./tests/unit/jest.setup.redis-mock.js'],
};
