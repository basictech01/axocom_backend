import { electionResolvers } from './election.resolver';
import { electionRepository } from '../../repositories/election.repository';
import { ok, err } from 'neverthrow';
import { GraphQLError } from 'graphql';
import { ERRORS } from '../../utils/error';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Election } from '../../models/election.model';

// Mock the repository
jest.mock('../../repositories/election.repository');
const mockRepository = electionRepository as jest.Mocked<typeof electionRepository>;

describe('ElectionResolvers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Query.election', () => {
        it('should return election when found', async () => {
            const mockElection: Election = {
                id: 1,
                name: 'Lok Sabha 2024',
                start_date: new Date('2024-04-19T00:00:00Z'),
                end_date: new Date('2024-06-01T00:00:00Z'),
                year: 2024,
                type: 'General',
                created_at: new Date(),
            } as Election;

            mockRepository.getById.mockResolvedValue(ok(mockElection));

            const result = await electionResolvers.Query.election(null, { id: 1 });

            expect(result).toEqual(mockElection);
            expect(mockRepository.getById).toHaveBeenCalledWith(1);
        });

        it('should throw GraphQLError when repository returns err', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.ELECTION_NOT_FOUND));

            await expect(
                electionResolvers.Query.election(null, { id: 999 })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError with INTERNAL_SERVER_ERROR code', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            try {
                await electionResolvers.Query.election(null, { id: 1 });
                fail('Should have thrown');
            } catch (error) {
                const gqlErr = error as GraphQLError;
                expect(gqlErr.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
                expect(gqlErr.message).toBe('Failed to fetch election');
            }
        });
    });

    describe('Query.elections', () => {
        it('should return all elections', async () => {
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

            mockRepository.getAll.mockResolvedValue(ok(mockElections));

            const result = await electionResolvers.Query.elections();

            expect(result).toEqual(mockElections);
            expect(mockRepository.getAll).toHaveBeenCalled();
        });

        it('should return empty array when repository returns ok([])', async () => {
            mockRepository.getAll.mockResolvedValue(ok([]));

            const result = await electionResolvers.Query.elections();

            expect(result).toEqual([]);
        });

        it('should throw GraphQLError when repository returns err', async () => {
            mockRepository.getAll.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                electionResolvers.Query.elections()
            ).rejects.toThrow(GraphQLError);
        });
    });
});