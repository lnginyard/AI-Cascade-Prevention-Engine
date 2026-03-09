module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/infrastructure'],
  testMatch: ['**/*.test.ts'],
  passWithNoTests: true,
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'infrastructure/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
