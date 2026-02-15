import { ApolloServer } from '@apollo/server';
import { buildGraphQL } from '../../src/graphql/loaders/graphql.loader';
import type { GraphQLContext } from '../../src/graphql/context';
import type { TokenData } from '../../src/utils/jwt';

// Create a test server for integration tests
export function createTestServer() {
    const { typeDefs, resolvers } = buildGraphQL();
    return new ApolloServer<GraphQLContext>({
        typeDefs,
        resolvers,
    });
}

// Create a test context for integration tests
export function createContext(overrides: { user?: TokenData | null; req?: any } = {}) {
    const { user = null, req = {} } = overrides;
    return { req, user } as GraphQLContext;
}

// Clean up console warnings during tests
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
};

// Set default test timeout
jest.setTimeout(10000);