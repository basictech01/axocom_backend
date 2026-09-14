// Global Jest behavior only. GraphQL server construction remains opt-in via
// tests/setup.ts so unit-test module mocks are installed before repositories load.
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
};

jest.setTimeout(10000);
