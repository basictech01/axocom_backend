// Clean up console warnings during tests
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
};

// Set default test timeout
jest.setTimeout(10000);