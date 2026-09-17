import { ApolloServer } from '@apollo/server';
import { createTestServer, createContext } from '../setup';
import { ok, err } from 'neverthrow';
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { partyRepository } from '../../repositories/party.repository';
import { ERRORS } from '../../utils/error';
import type { GraphQLContext } from '../../graphql/context';
import type { Party } from '../../models/party.model';

const GET_PARTY = `
  query GetParty($id: Int!) {
    party(id: $id) {
      id
      name
      symbol
      short_name
      party_type
      created_at
    }
  }
`;

const GET_PARTIES = `
  query GetParties {
    parties {
      id
      name
      symbol
      short_name
      party_type
    }
  }
`;

describe('Party integration(schema + resolvers)', () => {
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

    describe('Query.party', () => {
        it('returns party when found', async () => {
            const mockParty: Party = {
                id: 1,
                name: 'Bharatiya Janata Party',
                symbol: 'Lotus',
                short_name: 'BJP',
                party_type: 'National',
                created_at: new Date('2025-01-01T10:00:00Z'),
            } as Party;

            jest.spyOn(partyRepository, 'getById').mockResolvedValue(ok(mockParty));

            const response = await server.executeOperation(
                { query: GET_PARTY, variables: { id: 1 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.party).toBeDefined();
                expect(data?.party).toMatchObject({
                    id: 1,
                    name: 'Bharatiya Janata Party',
                    short_name: 'BJP',
                    party_type: 'National',
                });
            }

            expect(partyRepository.getById).toHaveBeenCalledWith(1);
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(partyRepository, 'getById')
                .mockResolvedValue(err(ERRORS.PARTY_NOT_FOUND));

            const response = await server.executeOperation(
                { query: GET_PARTY, variables: { id: 999 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                // field is nullable; on error it will typically be null
                expect(data?.party).toBeNull();
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch party');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });

    describe('Query.parties', () => {
        it('returns list of parties', async () => {
            const mockParties: Party[] = [
                {
                    id: 1,
                    name: 'Bharatiya Janata Party',
                    symbol: 'Lotus',
                    short_name: 'BJP',
                    party_type: 'National',
                    created_at: new Date(),
                } as Party,
                {
                    id: 2,
                    name: 'Indian National Congress',
                    symbol: 'Hand',
                    short_name: 'INC',
                    party_type: 'National',
                    created_at: new Date(),
                } as Party,
            ];

            jest.spyOn(partyRepository, 'getAll').mockResolvedValue(ok(mockParties));

            const response = await server.executeOperation(
                { query: GET_PARTIES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                const parties = data?.parties as Array<Record<string, unknown>>;
                expect(parties).toHaveLength(2);
                expect(parties[0]).toMatchObject({
                    id: 1,
                    name: 'Bharatiya Janata Party',
                    short_name: 'BJP',
                });
                expect(parties[1]).toMatchObject({
                    id: 2,
                    name: 'Indian National Congress',
                    short_name: 'INC',
                });
            }

            expect(partyRepository.getAll).toHaveBeenCalled();
        });

        it('returns empty array when no parties', async () => {
            jest.spyOn(partyRepository, 'getAll').mockResolvedValue(ok([]));

            const response = await server.executeOperation(
                { query: GET_PARTIES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.parties).toEqual([]);
            }
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(partyRepository, 'getAll')
                .mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            const response = await server.executeOperation(
                { query: GET_PARTIES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { errors } = body.singleResult;
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch parties');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });
});