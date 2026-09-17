import { ApolloServer } from '@apollo/server';
import { createTestServer, createContext } from '../setup';
import { ok, err } from 'neverthrow';
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { constituencyRepository } from '../../repositories/constituency.repository';
import { ERRORS } from '../../utils/error';
import type { GraphQLContext } from '../../graphql/context';
import type { Constituency } from '../../models/constituency.model';

const GET_CONSTITUENCY = `
  query GetConstituency($id: Int!) {
    constituency(id: $id) {
      id
      name
      state
      ac_number
      created_at
    }
  }
`;

const GET_CONSTITUENCIES = `
  query GetConstituencies {
    constituencies {
      id
      name
      state
      ac_number
    }
  }
`;

describe('Constituency integration(schema + resolvers)', () => {
    let server: ApolloServer<GraphQLContext>;

    beforeAll(async () => {
        server = createTestServer();
        await server.start();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await server.stop();
    });

    describe('Query.constituency', () => {
        it('returns constituency when found', async () => {
            const mockConstituency: Constituency = {
                id: 1,
                name: 'Mumbai North',
                state: 'Maharashtra',
                ac_number: 1,
                created_at: new Date('2025-01-01T10:00:00Z'),
            } as Constituency;

            jest
                .spyOn(constituencyRepository, 'getById')
                .mockResolvedValue(ok(mockConstituency));

            const response = await server.executeOperation(
                { query: GET_CONSTITUENCY, variables: { id: 1 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.constituency).toBeDefined();
                expect(data?.constituency).toMatchObject({
                    id: 1,
                    name: 'Mumbai North',
                    state: 'Maharashtra',
                    ac_number: 1,
                });
            }

            expect(constituencyRepository.getById).toHaveBeenCalledWith(1);
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(constituencyRepository, 'getById')
                .mockResolvedValue(err(ERRORS.CONSTITUENCY_NOT_FOUND));

            const response = await server.executeOperation(
                { query: GET_CONSTITUENCY, variables: { id: 999 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                // field is nullable; on error it will usually be null
                expect(data?.constituency).toBeNull();
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch constituency');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });

    describe('Query.constituencies', () => {
        it('returns list of constituencies', async () => {
            const mockConstituencies: Constituency[] = [
                {
                    id: 1,
                    name: 'Mumbai North',
                    state: 'Maharashtra',
                    ac_number: 1,
                    created_at: new Date(),
                } as Constituency,
                {
                    id: 2,
                    name: 'Mumbai South',
                    state: 'Maharashtra',
                    ac_number: 2,
                    created_at: new Date(),
                } as Constituency,
            ];

            jest
                .spyOn(constituencyRepository, 'getAll')
                .mockResolvedValue(ok(mockConstituencies));

            const response = await server.executeOperation(
                { query: GET_CONSTITUENCIES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                const constituencies = data?.constituencies as Array<Record<string, unknown>>;
                expect(constituencies).toHaveLength(2);
                expect(constituencies[0]).toMatchObject({
                    id: 1,
                    name: 'Mumbai North',
                    state: 'Maharashtra',
                });
                expect(constituencies[1]).toMatchObject({
                    id: 2,
                    name: 'Mumbai South',
                    state: 'Maharashtra',
                });
            }

            expect(constituencyRepository.getAll).toHaveBeenCalled();
        });

        it('returns empty array when no constituencies', async () => {
            jest
                .spyOn(constituencyRepository, 'getAll')
                .mockResolvedValue(ok([]));

            const response = await server.executeOperation(
                { query: GET_CONSTITUENCIES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.constituencies).toEqual([]);
            }
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(constituencyRepository, 'getAll')
                .mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            const response = await server.executeOperation(
                { query: GET_CONSTITUENCIES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { errors } = body.singleResult;
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch constituencies');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });
});