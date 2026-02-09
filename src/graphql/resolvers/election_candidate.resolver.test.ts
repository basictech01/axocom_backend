import { electionCandidateResolvers } from './election_candidate.resolver';
import { electionCandidateRepository } from '../../repositories/election_candidate.repository';
import { ok, err } from 'neverthrow';
import { GraphQLError } from 'graphql';
import { ERRORS } from '../../utils/error';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ElectionCandidate } from '../../models/election_candidate.model';

// Mock the repository
jest.mock('../../repositories/election_candidate.repository');
const mockRepository = electionCandidateRepository as jest.Mocked<typeof electionCandidateRepository>;

describe('ElectionCandidateResolvers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Query.election_candidate', () => {
        it('should return election candidate when found', async () => {
            const mockElectionCandidate: ElectionCandidate = {
                id: 1,
                election_id: 1,
                candidate_id: 10,
                constituency_id: 5,
                party_id: 2,
                created_at: new Date(),
            } as ElectionCandidate;

            mockRepository.getById.mockResolvedValue(ok(mockElectionCandidate));

            const result = await electionCandidateResolvers.Query.election_candidate(null, { id: 1 });

            expect(result).toEqual(mockElectionCandidate);
            expect(mockRepository.getById).toHaveBeenCalledWith(1);
        });

        it('should throw GraphQLError when repository fails', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                electionCandidateResolvers.Query.election_candidate(null, { id: 1 })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError with INTERNAL_SERVER_ERROR code', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.ELECTION_CANDIDATE_NOT_FOUND));

            try {
                await electionCandidateResolvers.Query.election_candidate(null, { id: 999 });
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                const gqlErr = error as GraphQLError;
                expect(gqlErr.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
                expect(gqlErr.message).toBe('Failed to fetch election candidate');
            }
        });
    });

    describe('Query.election_candidates', () => {
        it('should return all election candidates', async () => {
            const mockElectionCandidates: ElectionCandidate[] = [
                {
                    id: 1,
                    election_id: 1,
                    candidate_id: 10,
                    constituency_id: 5,
                    party_id: 2,
                    created_at: new Date(),
                } as ElectionCandidate,
                {
                    id: 2,
                    election_id: 1,
                    candidate_id: 11,
                    constituency_id: 6,
                    party_id: 3,
                    created_at: new Date(),
                } as ElectionCandidate,
            ];

            mockRepository.getAll.mockResolvedValue(ok(mockElectionCandidates));

            const result = await electionCandidateResolvers.Query.election_candidates();

            expect(result).toEqual(mockElectionCandidates);
            expect(mockRepository.getAll).toHaveBeenCalled();
        });

        it('should return empty array when no election candidates', async () => {
            mockRepository.getAll.mockResolvedValue(ok([]));

            const result = await electionCandidateResolvers.Query.election_candidates();

            expect(result).toEqual([]);
        });

        it('should throw GraphQLError on repository error', async () => {
            mockRepository.getAll.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                electionCandidateResolvers.Query.election_candidates()
            ).rejects.toThrow(GraphQLError);
        });
    });
});