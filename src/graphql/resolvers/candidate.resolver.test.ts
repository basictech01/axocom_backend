import { candidateResolvers } from './candidate.resolver';
import { candidateRepository } from '../../repositories/candidate.repository';
import { ok, err } from 'neverthrow';
import { GraphQLError } from 'graphql';
import { ERRORS } from '../../utils/error';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Candidate } from '../../models/candidate.model';
import type { GraphQLContext } from '../context';
import { TokenData } from '../../utils/jwt';

// Mock the repository
jest.mock('../../repositories/candidate.repository');
const mockRepository = candidateRepository as jest.Mocked<typeof candidateRepository>;

// Mock the context module
jest.mock('../context', () => ({
    requireAuth: jest.fn(),
}));

import { requireAuth } from '../context';
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

describe('CandidateResolvers', () => {
    const mockUser: TokenData = {
        id: 1,
        is_admin: false,
        email: 'test@example.com',
    };

    const mockContext: GraphQLContext = {
        req: {} as any,
        user: mockUser,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockRequireAuth.mockReturnValue(mockUser);
    });

    describe('Query.candidate', () => {
        it('should return candidate when found and authenticated', async () => {
            const mockCandidate: Candidate = {
                id: 1,
                neta_id: 1001,
                name: 'Candidate One',
                so_do_wo: 'S/O Parent',
                age: 45,
                candidate_image: null,
                assembly_constituency: 'Mumbai North',
                party: 'BJP',
                name_enrolled_as_voter_in: 'Mumbai North',
                self_profession: 'Engineer',
                spouse_profession: null,
                criminal_cases: 0,
                assets: 1000,
                liabilities: 100,
                education_category: 'Graduate',
                university_name: null,
                pan_itr: null,
                details_of_criminal_cases: null,
                details_of_movable_assets: null,
                details_of_immovable_assets: null,
                details_of_liabilities: null,
                source_of_income: null,
                contracts: null,
                social_profiles: null,
                created_at: new Date(),
            } as Candidate;

            mockRepository.getById.mockResolvedValue(ok(mockCandidate));

            const result = await candidateResolvers.Query.candidate(null, { id: 1 }, mockContext);

            expect(result).toEqual(mockCandidate);
            expect(mockRequireAuth).toHaveBeenCalledWith(mockContext);
            expect(mockRepository.getById).toHaveBeenCalledWith(1);
        });

        it('should throw GraphQLError when not authenticated', async () => {
            const unauthenticatedContext: GraphQLContext = {
                req: {} as any,
                user: null,
            };

            mockRequireAuth.mockImplementation(() => {
                throw new GraphQLError('Unauthorized', {
                    extensions: { code: 'UNAUTHORIZED', statusCode: 401, errorCode: 20005 },
                });
            });

            await expect(
                candidateResolvers.Query.candidate(null, { id: 1 }, unauthenticatedContext)
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError with code 30001 when candidate not found', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.CANDIDATE_NOT_FOUND));

            try {
                await candidateResolvers.Query.candidate(null, { id: 999 }, mockContext);
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                const gqlErr = error as GraphQLError;
                expect(gqlErr.extensions?.code).toBe('30001');
                expect(gqlErr.message).toBe('Candidate not found');
            }
        });
    });

    describe('Query.candidates', () => {
        it('should return all candidates', async () => {
            const mockCandidates: Candidate[] = [
                {
                    id: 1,
                    neta_id: 1001,
                    name: 'Candidate One',
                    so_do_wo: 'S/O Parent',
                    age: 45,
                    candidate_image: null,
                    assembly_constituency: 'Mumbai North',
                    party: 'BJP',
                    name_enrolled_as_voter_in: 'Mumbai North',
                    self_profession: 'Engineer',
                    spouse_profession: null,
                    criminal_cases: 0,
                    assets: 1000,
                    liabilities: 100,
                    education_category: 'Graduate',
                    university_name: null,
                    pan_itr: null,
                    details_of_criminal_cases: null,
                    details_of_movable_assets: null,
                    details_of_immovable_assets: null,
                    details_of_liabilities: null,
                    source_of_income: null,
                    contracts: null,
                    social_profiles: null,
                    created_at: new Date(),
                } as Candidate,
            ];

            mockRepository.getAllCandidates.mockResolvedValue(ok(mockCandidates));

            const result = await candidateResolvers.Query.candidates();

            expect(result).toEqual(mockCandidates);
            expect(mockRepository.getAllCandidates).toHaveBeenCalled();
        });

        it('should return empty array when no candidates', async () => {
            mockRepository.getAllCandidates.mockResolvedValue(ok([]));

            const result = await candidateResolvers.Query.candidates();

            expect(result).toEqual([]);
        });

        it('should throw GraphQLError with code 30002 when repository fails', async () => {
            mockRepository.getAllCandidates.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            try {
                await candidateResolvers.Query.candidates();
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                const gqlErr = error as GraphQLError;
                expect(gqlErr.extensions?.code).toBe('30002');
                expect(gqlErr.message).toBe('Candidate not found');
            }
        });
    });
});