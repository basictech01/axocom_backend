import { partyResolvers } from './party.resolver';
import { partyRepository } from '../../repositories/party.repository';
import { ok, err } from 'neverthrow';
import { GraphQLError } from 'graphql';
import { ERRORS } from '../../utils/error';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Party } from '../../models/party.model';

// Mock the repository
jest.mock('../../repositories/party.repository');
const mockRepository = partyRepository as jest.Mocked<typeof partyRepository>;

describe('PartyResolvers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Query.party', () => {
        it('should return party when found', async () => {
            const mockParty: Party = {
                id: 1,
                name: 'Bharatiya Janata Party',
                symbol: 'Lotus',
                short_name: 'BJP',
                party_type: 'National',
                created_at: new Date(),
            } as Party;

            mockRepository.getById.mockResolvedValue(ok(mockParty));

            const result = await partyResolvers.Query.party(null, { id: 1 });

            expect(result).toEqual(mockParty);
            expect(mockRepository.getById).toHaveBeenCalledWith(1);
        });

        it('should throw GraphQLError when repository returns err', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.PARTY_NOT_FOUND));

            await expect(
                partyResolvers.Query.party(null, { id: 999 })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError with INTERNAL_SERVER_ERROR code', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            try {
                await partyResolvers.Query.party(null, { id: 1 });
                fail('Should have thrown');
            } catch (error) {
                const gqlErr = error as GraphQLError;
                expect(gqlErr.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
                expect(gqlErr.message).toBe('Failed to fetch party');
            }
        });
    });

    describe('Query.parties', () => {
        it('should return all parties', async () => {
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

            mockRepository.getAll.mockResolvedValue(ok(mockParties));

            const result = await partyResolvers.Query.parties();

            expect(result).toEqual(mockParties);
            expect(mockRepository.getAll).toHaveBeenCalled();
        });

        it('should return empty array when repository returns ok([])', async () => {
            mockRepository.getAll.mockResolvedValue(ok([]));

            const result = await partyResolvers.Query.parties();

            expect(result).toEqual([]);
        });

        it('should throw GraphQLError when repository returns err', async () => {
            mockRepository.getAll.mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            await expect(
                partyResolvers.Query.parties()
            ).rejects.toThrow(GraphQLError);
        });
    });
});