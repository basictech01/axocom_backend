import { constituencyResolvers } from './constituency.resolver';
import { constituencyRepository } from '../../repositories/constituency.repository';
import { ok, err } from 'neverthrow';
import { GraphQLError } from 'graphql';
import { ERRORS } from '../../utils/error';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Constituency } from '../../models/constituency.model';

// Mock the repository
jest.mock('../../repositories/constituency.repository');
const mockRepository = constituencyRepository as jest.Mocked<typeof constituencyRepository>;

describe('ConstituencyResolvers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Query.constituency', () => {
        it('should return constituency when found', async () => {
            const mockConstituency: Constituency = {
                id: 1,
                name: 'Mumbai North',
                state: 'Maharashtra',
                ac_number: 1,
                created_at: new Date(),
            } as Constituency;

            mockRepository.getById.mockResolvedValue(ok(mockConstituency));

            const result = await constituencyResolvers.Query.constituency(null, { id: 1 });

            expect(result).toEqual(mockConstituency);
            expect(mockRepository.getById).toHaveBeenCalledWith(1);
        });

        it('should throw GraphQLError when repository fails', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                constituencyResolvers.Query.constituency(null, { id: 1 })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError with INTERNAL_SERVER_ERROR code', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.CONSTITUENCY_NOT_FOUND));

            try {
                await constituencyResolvers.Query.constituency(null, { id: 999 });
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                const gqlErr = error as GraphQLError;
                expect(gqlErr.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
                expect(gqlErr.message).toBe('Failed to fetch constituency');
            }
        });
    });

    describe('Query.constituencies', () => {
        it('should return all constituencies', async () => {
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

            mockRepository.getAll.mockResolvedValue(ok(mockConstituencies));

            const result = await constituencyResolvers.Query.constituencies();

            expect(result).toEqual(mockConstituencies);
            expect(mockRepository.getAll).toHaveBeenCalled();
        });

        it('should return empty array when no constituencies', async () => {
            mockRepository.getAll.mockResolvedValue(ok([]));

            const result = await constituencyResolvers.Query.constituencies();

            expect(result).toEqual([]);
        });

        it('should throw GraphQLError on repository error', async () => {
            mockRepository.getAll.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                constituencyResolvers.Query.constituencies()
            ).rejects.toThrow(GraphQLError);
        });
    });
});