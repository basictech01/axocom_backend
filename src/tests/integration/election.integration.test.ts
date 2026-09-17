import { ApolloServer } from '@apollo/server';
import { createTestServer, createContext } from '../setup';
import { ok, err } from 'neverthrow';
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { electionRepository } from '../../repositories/election.repository';
import { ERRORS } from '../../utils/error';
import type { GraphQLContext } from '../../graphql/context';
import type { Election } from '../../models/election.model';

const GET_ELECTION = `
  query GetElection($id: Int!) {
    election(id: $id) {
      id
      name
      start_date
      end_date
      year
      type
      created_at
    }
  }
`;

const GET_ELECTIONS = `
  query GetElections {
    elections {
      id
      name
      year
      type
    }
  }
`;

describe('Election integration(schema + resolvers)', () => {
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

    describe('Query.election', () => {
        it('returns election when found', async () => {
            const mockElection: Election = {
                id: 1,
                name: 'Lok Sabha 2024',
                start_date: new Date('2024-04-19T00:00:00Z'),
                end_date: new Date('2024-06-01T00:00:00Z'),
                year: 2024,
                type: 'General',
                created_at: new Date('2024-01-01T00:00:00Z'),
            } as Election;

            jest
                .spyOn(electionRepository, 'getById')
                .mockResolvedValue(ok(mockElection));

            const response = await server.executeOperation(
                { query: GET_ELECTION, variables: { id: 1 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.election).toBeDefined();
                expect(data?.election).toMatchObject({
                    id: 1,
                    name: 'Lok Sabha 2024',
                    year: 2024,
                    type: 'General',
                });
            }

            expect(electionRepository.getById).toHaveBeenCalledWith(1);
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(electionRepository, 'getById')
                .mockResolvedValue(err(ERRORS.ELECTION_NOT_FOUND));

            const response = await server.executeOperation(
                { query: GET_ELECTION, variables: { id: 999 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(data?.election).toBeNull();
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch election');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });

    describe('Query.elections', () => {
        it('returns list of elections', async () => {
            const mockElections: Election[] = [
                {
                    id: 1,
                    name: 'Lok Sabha 2024',
                    start_date: new Date('2024-04-19T00:00:00Z'),
                    end_date: new Date('2024-06-01T00:00:00Z'),
                    year: 2024,
                    type: 'General',
                    created_at: new Date(),
                } as Election,
                {
                    id: 2,
                    name: 'State Assembly 2023',
                    start_date: new Date('2023-10-15T00:00:00Z'),
                    end_date: new Date('2023-11-30T00:00:00Z'),
                    year: 2023,
                    type: 'State',
                    created_at: new Date(),
                } as Election,
            ];

            jest
                .spyOn(electionRepository, 'getAll')
                .mockResolvedValue(ok(mockElections));

            const response = await server.executeOperation(
                { query: GET_ELECTIONS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                const elections = data?.elections as Array<Record<string, unknown>>;
                expect(elections).toHaveLength(2);
                expect(elections[0]).toMatchObject({
                    id: 1,
                    name: 'Lok Sabha 2024',
                    year: 2024,
                });
                expect(elections[1]).toMatchObject({
                    id: 2,
                    name: 'State Assembly 2023',
                    year: 2023,
                });
            }

            expect(electionRepository.getAll).toHaveBeenCalled();
        });

        it('returns empty array when no elections', async () => {
            jest
                .spyOn(electionRepository, 'getAll')
                .mockResolvedValue(ok([]));

            const response = await server.executeOperation(
                { query: GET_ELECTIONS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.elections).toEqual([]);
            }
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(electionRepository, 'getAll')
                .mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            const response = await server.executeOperation(
                { query: GET_ELECTIONS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { errors } = body.singleResult;
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch elections');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });
});