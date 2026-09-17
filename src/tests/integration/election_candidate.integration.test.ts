import { ApolloServer } from '@apollo/server';
import { createTestServer, createContext } from '../setup';
import { ok, err } from 'neverthrow';
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { electionCandidateRepository } from '../../repositories/election_candidate.repository';
import { ERRORS } from '../../utils/error';
import type { GraphQLContext } from '../../graphql/context';
import type { ElectionCandidate } from '../../models/election_candidate.model';

const GET_ELECTION_CANDIDATE = `
  query GetElectionCandidate($id: Int!) {
    election_candidate(id: $id) {
      id
      election_id
      candidate_id
      constituency_id
      party_id
      created_at
    }
  }
`;

const GET_ELECTION_CANDIDATES = `
  query GetElectionCandidates {
    election_candidates {
      id
      election_id
      candidate_id
      constituency_id
      party_id
    }
  }
`;

describe('ElectionCandidate integration(schema + resolvers)', () => {
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

    describe('Query.election_candidate', () => {
        it('returns election candidate when found', async () => {
            const mockEC: ElectionCandidate = {
                id: 1,
                election_id: 10,
                candidate_id: 100,
                constituency_id: 5,
                party_id: 2,
                created_at: new Date('2025-01-01T10:00:00Z'),
            } as ElectionCandidate;

            jest
                .spyOn(electionCandidateRepository, 'getById')
                .mockResolvedValue(ok(mockEC));

            const response = await server.executeOperation(
                { query: GET_ELECTION_CANDIDATE, variables: { id: 1 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.election_candidate).toBeDefined();
                expect(data?.election_candidate).toMatchObject({
                    id: 1,
                    election_id: 10,
                    candidate_id: 100,
                    constituency_id: 5,
                    party_id: 2,
                });
            }

            expect(electionCandidateRepository.getById).toHaveBeenCalledWith(1);
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(electionCandidateRepository, 'getById')
                .mockResolvedValue(err(ERRORS.ELECTION_CANDIDATE_NOT_FOUND));

            const response = await server.executeOperation(
                { query: GET_ELECTION_CANDIDATE, variables: { id: 999 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                // field is nullable; on error it will typically be null
                expect(data?.election_candidate).toBeNull();
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch election candidate');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });

    describe('Query.election_candidates', () => {
        it('returns list of election candidates', async () => {
            const mockECs: ElectionCandidate[] = [
                {
                    id: 1,
                    election_id: 10,
                    candidate_id: 100,
                    constituency_id: 5,
                    party_id: 2,
                    created_at: new Date(),
                } as ElectionCandidate,
                {
                    id: 2,
                    election_id: 10,
                    candidate_id: 101,
                    constituency_id: 6,
                    party_id: 3,
                    created_at: new Date(),
                } as ElectionCandidate,
            ];

            jest
                .spyOn(electionCandidateRepository, 'getAll')
                .mockResolvedValue(ok(mockECs));

            const response = await server.executeOperation(
                { query: GET_ELECTION_CANDIDATES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                const electionCandidates = data?.election_candidates as Array<Record<string, unknown>>;
                expect(electionCandidates).toHaveLength(2);
                expect(electionCandidates[0]).toMatchObject({
                    id: 1,
                    election_id: 10,
                    candidate_id: 100,
                });
                expect(electionCandidates[1]).toMatchObject({
                    id: 2,
                    election_id: 10,
                    candidate_id: 101,
                });
            }

            expect(electionCandidateRepository.getAll).toHaveBeenCalled();
        });

        it('returns empty array when no election candidates', async () => {
            jest
                .spyOn(electionCandidateRepository, 'getAll')
                .mockResolvedValue(ok([]));

            const response = await server.executeOperation(
                { query: GET_ELECTION_CANDIDATES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.election_candidates).toEqual([]);
            }
        });

        it('returns GraphQLError when repository returns err', async () => {
            jest
                .spyOn(electionCandidateRepository, 'getAll')
                .mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            const response = await server.executeOperation(
                { query: GET_ELECTION_CANDIDATES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { errors } = body.singleResult;
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch election candidates');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });
});