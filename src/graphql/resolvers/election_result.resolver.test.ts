import { electionResultResolvers } from './election_result.resolver';
import { electionResultRepository } from '../../repositories/election_result.repository';
import { ok, err } from 'neverthrow';
import { GraphQLError } from 'graphql';
import { ERRORS } from '../../utils/error';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ElectionResult } from '../../models/election_result.model';

// Mock the repository
jest.mock('../../repositories/election_result.repository');
const mockRepository = electionResultRepository as jest.Mocked<typeof electionResultRepository>;

describe('ElectionResultResolvers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Query.election_result', () => {
        it('should return election result when found', async () => {
            const mockResult: ElectionResult = {
                id: 1,
                election_candidate_id: 10,
                votes_polled: 50000,
                rank: 1,
                status: 'Won',
                created_at: new Date(),
            } as ElectionResult;

            mockRepository.getById.mockResolvedValue(ok(mockResult));

            const result = await electionResultResolvers.Query.election_result(null, { id: 1 });

            expect(result).toEqual(mockResult);
            expect(mockRepository.getById).toHaveBeenCalledWith(1);
        });

        it('should throw GraphQLError when repository fails', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                electionResultResolvers.Query.election_result(null, { id: 1 })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError with INTERNAL_SERVER_ERROR code', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.ELECTION_RESULT_NOT_FOUND));

            try {
                await electionResultResolvers.Query.election_result(null, { id: 999 });
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                const gqlErr = error as GraphQLError;
                expect(gqlErr.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
                expect(gqlErr.message).toBe('Failed to fetch election result');
            }
        });
    });

    describe('Query.election_results', () => {
        it('should return all election results', async () => {
            const mockResults: ElectionResult[] = [
                {
                    id: 1,
                    election_candidate_id: 10,
                    votes_polled: 50000,
                    rank: 1,
                    status: 'Won',
                    created_at: new Date(),
                } as ElectionResult,
                {
                    id: 2,
                    election_candidate_id: 11,
                    votes_polled: 35000,
                    rank: 2,
                    status: 'Lost',
                    created_at: new Date(),
                } as ElectionResult,
                {
                    id: 3,
                    election_candidate_id: 12,
                    votes_polled: 40000,
                    rank: 1,
                    status: 'Won',
                    created_at: new Date(),
                } as ElectionResult,
            ];

            mockRepository.getAll.mockResolvedValue(ok(mockResults));

            const result = await electionResultResolvers.Query.election_results();

            expect(result).toEqual(mockResults);
            expect(mockRepository.getAll).toHaveBeenCalled();
        });

        it('should return empty array when no election results', async () => {
            mockRepository.getAll.mockResolvedValue(ok([]));

            const result = await electionResultResolvers.Query.election_results();

            expect(result).toEqual([]);
        });

        it('should throw GraphQLError on repository error', async () => {
            mockRepository.getAll.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                electionResultResolvers.Query.election_results()
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError with INTERNAL_SERVER_ERROR code', async () => {
            mockRepository.getAll.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            try {
                await electionResultResolvers.Query.election_results();
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                const gqlErr = error as GraphQLError;
                expect(gqlErr.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
                expect(gqlErr.message).toBe('Failed to fetch election results');
            }
        });
    });
});