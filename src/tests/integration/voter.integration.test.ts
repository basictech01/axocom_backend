import { ApolloServer } from '@apollo/server';
import { createTestServer, createContext } from '../setup';
import { ok, err } from 'neverthrow';
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { voterRepository } from '../../repositories/voter.repository';
import { ERRORS } from '../../utils/error';
import type { GraphQLContext } from '../../graphql/context';
import type { Voter } from '../../models/voter.model';

const GET_VOTER = `
  query GetVoter($id: Int!) {
    voter(id: $id) {
      id
      epic_number
      first_name_english
      first_name_local
      last_name_english
      last_name_local
      gender
      age
      relative_first_name_english
      relative_first_name_local
      relative_last_name_english
      relative_last_name_local
      state
      parliamentary_constituency
      assembly_constituency
      polling_station
      part_number_name
      part_serial_number
      fetch_status
      fetch_attempts
      error_message
      last_attempt
      created_at
      updated_at
    }
  }
`;

const GET_VOTERS = `
  query GetVoters {
    voters {
      id
      epic_number
      first_name_english
      gender
      age
      state
      assembly_constituency
    }
  }
`;

describe('Voter integration(schema + resolvers)', () => {
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

    describe('Query.voter', () => {
        it('returns voter when found', async () => {
            const mockVoter: Voter = {
                id: 1,
                epic_number: 'EPIC001',
                first_name_english: 'John',
                first_name_local: 'जॉन',
                last_name_english: 'Doe',
                last_name_local: 'डो',
                gender: 'M',
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
                last_attempt: new Date('2025-01-01T10:00:00Z'),
                created_at: new Date('2025-01-01T10:00:00Z'),
                updated_at: new Date('2025-01-01T10:00:00Z'),
            } as Voter;

            jest.spyOn(voterRepository, 'getById').mockResolvedValue(ok(mockVoter));

            const response = await server.executeOperation(
                { query: GET_VOTER, variables: { id: 1 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.voter).toBeDefined();
                expect(data?.voter).toMatchObject({
                    id: 1,
                    epic_number: 'EPIC001',
                    first_name_english: 'John',
                    state: 'Maharashtra',
                    assembly_constituency: 'Andheri West',
                });
            }

            expect(voterRepository.getById).toHaveBeenCalledWith(1);
        });

        it('returns GraphQL error when repository returns err', async () => {
            jest.spyOn(voterRepository, 'getById').mockResolvedValue(err(ERRORS.VOTER_NOT_FOUND));

            const response = await server.executeOperation(
                { query: GET_VOTER, variables: { id: 999 } },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                // voter field is nullable; on thrown error, GraphQL typically returns null here
                expect(data?.voter).toBeNull();
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch voter');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });

    describe('Query.voters', () => {
        it('returns list of voters', async () => {
            const mockVoters: Voter[] = [
                {
                    id: 1,
                    epic_number: 'EPIC001',
                    first_name_english: 'John',
                    first_name_local: 'जॉन',
                    last_name_english: 'Doe',
                    last_name_local: 'डो',
                    gender: 'M',
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
                    epic_number: 'EPIC002',
                    first_name_english: 'Jane',
                    first_name_local: 'जेन',
                    last_name_english: 'Smith',
                    last_name_local: 'स्मिथ',
                    gender: 'F',
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

            jest.spyOn(voterRepository, 'getAll').mockResolvedValue(ok(mockVoters));

            const response = await server.executeOperation(
                { query: GET_VOTERS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                const voters = data?.voters as Array<Record<string, unknown>>;
                expect(voters).toHaveLength(2);
                expect(voters[0]).toMatchObject({
                    id: 1,
                    epic_number: 'EPIC001',
                    first_name_english: 'John',
                });
                expect(voters[1]).toMatchObject({
                    id: 2,
                    epic_number: 'EPIC002',
                    first_name_english: 'Jane',
                });
            }

            expect(voterRepository.getAll).toHaveBeenCalled();
        });

        it('returns empty array when no voters', async () => {
            jest.spyOn(voterRepository, 'getAll').mockResolvedValue(ok([]));

            const response = await server.executeOperation(
                { query: GET_VOTERS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.voters).toEqual([]);
            }
        });

        it('returns GraphQL error when repository returns err', async () => {
            jest.spyOn(voterRepository, 'getAll').mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            const response = await server.executeOperation(
                { query: GET_VOTERS },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { errors } = body.singleResult;
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Failed to fetch voters');
                expect(errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
            }
        });
    });
});