import { ApolloServer } from '@apollo/server';
import { createTestServer, createContext } from '../setup';
import { ok, err } from 'neverthrow';
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { electionResultRepository } from '../../repositories/election_result.repository';
import { ERRORS } from '../../utils/error';
import type { GraphQLContext } from '../../graphql/context';
import type { ElectionResult } from '../../models/election_result.model';

const GET_ELECTION_RESULT = `
  query GetElectionResult($id: Int!) {
    election_result(id: $id) {
      id
      election_candidate_id
      votes_polled
      position
      status
      created_at
    }
  }
`;

const GET_ELECTION_RESULTS = `
  query GetElectionResults {
    election_results {
      id
      election_candidate_id
      votes_polled
      position
      status
    }
  }
`;

describe('ElectionResult integration(schema + resolvers)', () => {
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

    describe('Query.election_result', () => {
        it('returns election result when found', async () => {
            const mockER: ElectionResult = {
                id: 1,
                election_candidate_id: 10,
                votes_polled: 50000,
                position: 1,
                status: 'Won',
                created_at: new Date('2025-01-01T10:00:00Z'),
            } as ElectionResult;

            jest
                .spyOn(electionResultRepository, 'getById')
                .mockResolvedValue(ok(mockER));

            const response = await server.executeOperation(
                { query: GET_ELECTION_RESULT, variables: { id: 1 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.election_result).toBeDefined();
                expect(data?.election_result).toMatchObject({
                    id: 1,
                    election_candidate_id: 10,
                    votes_polled: 50000,
                    position: 1,
                    status: 'Won',
                });
            }

            expect(electionResultRepository.getById).toHaveBeenCalledWith(1);
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(electionResultRepository, 'getById')
                .mockResolvedValue(err(ERRORS.ELECTION_RESULT_NOT_FOUND));

            const response = await server.executeOperation(
                { query: GET_ELECTION_RESULT, variables: { id: 999 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(data?.election_result).toBeNull();
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch election result');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });

    describe('Query.election_results', () => {
        it('returns list of election results', async () => {
            const mockERs: ElectionResult[] = [
                {
                    id: 1,
                    election_candidate_id: 10,
                    votes_polled: 50000,
                    position: 1,
                    status: 'Won',
                    created_at: new Date(),
                } as ElectionResult,
                {
                    id: 2,
                    election_candidate_id: 11,
                    votes_polled: 35000,
                    position: 2,
                    status: 'Lost',
                    created_at: new Date(),
                } as ElectionResult,
            ];

            jest
                .spyOn(electionResultRepository, 'getAll')
                .mockResolvedValue(ok(mockERs));

            const response = await server.executeOperation(
                { query: GET_ELECTION_RESULTS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.election_results).toHaveLength(2);
                expect(data?.election_results[0]).toMatchObject({
                    id: 1,
                    election_candidate_id: 10,
                    votes_polled: 50000,
                    position: 1,
                    status: 'Won',
                });
                expect(data?.election_results[1]).toMatchObject({
                    id: 2,
                    election_candidate_id: 11,
                    votes_polled: 35000,
                    position: 2,
                    status: 'Lost',
                });
            }

            expect(electionResultRepository.getAll).toHaveBeenCalled();
        });

        it('returns empty array when no election results', async () => {
            jest
                .spyOn(electionResultRepository, 'getAll')
                .mockResolvedValue(ok([]));

            const response = await server.executeOperation(
                { query: GET_ELECTION_RESULTS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.election_results).toEqual([]);
            }
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(electionResultRepository, 'getAll')
                .mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            const response = await server.executeOperation(
                { query: GET_ELECTION_RESULTS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { errors } = body.singleResult;
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch election results');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });
});