import { voterResolvers } from '../resolvers/voter.resolver';
import { voterRepository } from '../../repositories/voter.repository';
import { ok, err } from 'neverthrow';
import { GraphQLError } from 'graphql';
import { ERRORS } from '../../utils/error';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Voter } from '../../models/voter.model';

// Mock the repository
jest.mock('../../repositories/voter.repository');
const mockRepository = voterRepository as jest.Mocked<typeof voterRepository>;

describe('VoterResolvers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Query.voter', () => {
        it('should return voter when found', async () => {
            const mockVoter: Voter = {
                id: 1,
                epic_number: 'ABC1234567',
                first_name_english: 'John',
                first_name_local: 'जॉन',
                last_name_english: 'Doe',
                last_name_local: 'डो',
                gender: 'Male',
                age: 30,
                relative_first_name_english: 'Jane',
                relative_first_name_local: 'जेन',
                relative_last_name_english: 'Doe',
                relative_last_name_local: 'डो',
                state: 'Maharashtra',
                parliamentary_constituency: 'Mumbai North',
                assembly_constituency: 'Andheri West',
                polling_station: 'Station 1',
                part_number_name: 'Part 1',
                part_serial_number: 123,
                fetch_status: 'completed',
                fetch_attempts: 1,
                error_message: '',
                last_attempt: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            } as Voter;

            mockRepository.getById.mockResolvedValue(ok(mockVoter));

            const result = await voterResolvers.Query.voter(null, { id: 1 });

            expect(result).toEqual(mockVoter);
            expect(mockRepository.getById).toHaveBeenCalledWith(1);
        });

        it('should throw GraphQLError when repository fails', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                voterResolvers.Query.voter(null, { id: 1 })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError with correct code', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.VOTER_NOT_FOUND));

            try {
                await voterResolvers.Query.voter(null, { id: 999 });
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                expect((error as GraphQLError).extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });

    describe('Query.voters', () => {
        it('should return all voters', async () => {
            const mockVoters: Voter[] = [
                {
                    id: 1,
                    epic_number: 'ABC1',
                    first_name_english: 'John',
                    first_name_local: 'जॉन',
                    last_name_english: 'Doe',
                    last_name_local: 'डो',
                    gender: 'Male',
                    age: 30,
                    relative_first_name_english: 'Jane',
                    relative_first_name_local: 'जेन',
                    relative_last_name_english: 'Doe',
                    relative_last_name_local: 'डो',
                    state: 'Maharashtra',
                    parliamentary_constituency: 'Mumbai North',
                    assembly_constituency: 'Andheri West',
                    polling_station: 'Station 1',
                    part_number_name: 'Part 1',
                    part_serial_number: 123,
                    fetch_status: 'completed',
                    fetch_attempts: 1,
                    error_message: '',
                    last_attempt: new Date(),
                    created_at: new Date(),
                    updated_at: new Date(),
                } as Voter,
                {
                    id: 2,
                    epic_number: 'ABC2',
                    first_name_english: 'Jane',
                    first_name_local: 'जेन',
                    last_name_english: 'Smith',
                    last_name_local: 'स्मिथ',
                    gender: 'Female',
                    age: 28,
                    relative_first_name_english: 'John',
                    relative_first_name_local: 'जॉन',
                    relative_last_name_english: 'Smith',
                    relative_last_name_local: 'स्मिथ',
                    state: 'Maharashtra',
                    parliamentary_constituency: 'Mumbai South',
                    assembly_constituency: 'Bandra East',
                    polling_station: 'Station 2',
                    part_number_name: 'Part 2',
                    part_serial_number: 456,
                    fetch_status: 'completed',
                    fetch_attempts: 1,
                    error_message: '',
                    last_attempt: new Date(),
                    created_at: new Date(),
                    updated_at: new Date(),
                } as Voter,
            ];

            mockRepository.getAll.mockResolvedValue(ok(mockVoters));

            const result = await voterResolvers.Query.voters();

            expect(result).toEqual(mockVoters);
            expect(mockRepository.getAll).toHaveBeenCalled();
        });

        it('should return empty array when no voters', async () => {
            mockRepository.getAll.mockResolvedValue(ok([]));

            const result = await voterResolvers.Query.voters();

            expect(result).toEqual([]);
        });

        it('should throw GraphQLError on repository error', async () => {
            mockRepository.getAll.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(voterResolvers.Query.voters()).rejects.toThrow(GraphQLError);
        });
    });
});