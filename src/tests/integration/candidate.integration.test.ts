import { ApolloServer } from '@apollo/server';
import { createTestServer, createContext } from '../setup';
import { ok, err } from 'neverthrow';
import { describe, it, expect, jest, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { candidateRepository } from '../../repositories/candidate.repository';
import { ERRORS } from '../../utils/error';
import type { GraphQLContext } from '../../graphql/context';
import type { Candidate } from '../../models/candidate.model';
import type { TokenData } from '../../utils/jwt';

const GET_CANDIDATE = `
  query GetCandidate($id: Int!) {
    candidate(id: $id) {
      id
      name
      so_do_wo
      age
      assembly_constituency
      party
      name_enrolled_as_voter_in
      education_category
      university_name
      source_of_income
      contracts
      social_profiles
      created_at
    }
  }
`;

const GET_CANDIDATES = `
  query GetCandidates {
    candidates {
      id
      name
      age
      assembly_constituency
      self_profession
      spouse_profession
      education_category
      university_name
      party
    }
  }
`;

describe('Candidate integration(schema + resolvers)', () => {
    let server: ApolloServer<GraphQLContext>;

    const authedUser: TokenData = {
        id: 1,
        is_admin: false,
        email: 'test@example.com',
    };

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

    describe('Query.candidate', () => {
        it('returns candidate when found and authenticated', async () => {
            const mockCandidate: Candidate = {
                id: 1,
                neta_id: 1001,
                name: 'Candidate One',
                so_do_wo: 'S/O Parent',
                age: 45,
                candidate_image: 'https://example.com/img.jpg',
                assembly_constituency: 'Mumbai North',
                party: 'BJP',
                name_enrolled_as_voter_in: 'Mumbai North',
                self_profession: 'Engineer',
                spouse_profession: 'Doctor',
                criminal_cases: 0,
                assets: 1000000,
                liabilities: 10000,
                education_category: 'Graduate',
                university_name: 'Test University',
                pan_itr: null as any,
                details_of_criminal_cases: null as any,
                details_of_movable_assets: null as any,
                details_of_immovable_assets: null as any,
                details_of_liabilities: null as any,
                source_of_income: null as any,
                contracts: null as any,
                social_profiles: null as any,
                created_at: new Date('2025-01-01T10:00:00Z'),
            } as unknown as Candidate;

            jest.spyOn(candidateRepository, 'getById').mockResolvedValue(ok(mockCandidate));

            const response = await server.executeOperation(
                { query: GET_CANDIDATE, variables: { id: 1 } },
                { contextValue: createContext({ user: authedUser }) }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.candidate).toBeDefined();
                expect(data?.candidate).toMatchObject({
                    id: 1,
                    name: 'Candidate One',
                    assembly_constituency: 'Mumbai North',
                    party: 'BJP',
                });
            }

            expect(candidateRepository.getById).toHaveBeenCalledWith(1);
        });

        it('returns UNAUTHORIZED error when not authenticated', async () => {
            // No repo call should be needed; requireAuth should throw first
            const spy = jest.spyOn(candidateRepository, 'getById');

            const response = await server.executeOperation(
                { query: GET_CANDIDATE, variables: { id: 1 } },
                { contextValue: createContext({ user: null }) }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(data?.candidate).toBeNull();
                expect(errors).toHaveLength(1);
                expect(errors?.[0].extensions?.code).toBe('UNAUTHORIZED');
            }

            expect(spy).not.toHaveBeenCalled();
        });

        it('returns GraphQLError with code 30001 when candidate not found', async () => {
            jest
                .spyOn(candidateRepository, 'getById')
                .mockResolvedValue(err(ERRORS.CANDIDATE_NOT_FOUND));

            const response = await server.executeOperation(
                { query: GET_CANDIDATE, variables: { id: 999 } },
                { contextValue: createContext({ user: authedUser }) }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { errors } = body.singleResult;
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Candidate not found');
                expect(errors?.[0].extensions?.code).toBe('30001');
            }
        });
    });

    describe('Query.candidates', () => {
        it('returns list of candidates', async () => {
            const mockCandidates: Candidate[] = [
                {
                    id: 1,
                    name: 'Candidate One',
                    so_do_wo: 'S/O Parent',
                    age: 45,
                    candidate_image: null as any,
                    assembly_constituency: 'Mumbai North',
                    party: 'BJP',
                    name_enrolled_as_voter_in: 'Mumbai North',
                    self_profession: null as any,
                    spouse_profession: null as any,
                    criminal_cases: 0,
                    assets: 1000000,
                    liabilities: 10000,
                    education_category: null as any,
                    university_name: null as any,
                    pan_itr: null as any,
                    details_of_criminal_cases: null as any,
                    details_of_movable_assets: null as any,
                    details_of_immovable_assets: null as any,
                    details_of_liabilities: null as any,
                    source_of_income: null as any,
                    contracts: null as any,
                    social_profiles: null as any,
                    created_at: new Date(),
                } as unknown as Candidate,
                {
                    id: 2,
                    name: 'Candidate Two',
                    so_do_wo: 'D/O Parent',
                    age: 38,
                    candidate_image: null as any,
                    assembly_constituency: 'Mumbai South',
                    party: 'INC',
                    name_enrolled_as_voter_in: 'Mumbai South',
                    self_profession: null as any,
                    spouse_profession: null as any,
                    criminal_cases: 0,
                    assets: 500000,
                    liabilities: 5000,
                    education_category: null as any,
                    university_name: null as any,
                    pan_itr: null as any,
                    details_of_criminal_cases: null as any,
                    details_of_movable_assets: null as any,
                    details_of_immovable_assets: null as any,
                    details_of_liabilities: null as any,
                    source_of_income: null as any,
                    contracts: null as any,
                    social_profiles: null as any,
                    created_at: new Date(),
                } as unknown as Candidate,
            ];

            jest
                .spyOn(candidateRepository, 'getAllCandidates')
                .mockResolvedValue(ok(mockCandidates));

            const response = await server.executeOperation(
                { query: GET_CANDIDATES },
                { contextValue: createContext() } // this query is public (no auth)
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.candidates).toHaveLength(2);
                expect(data?.candidates[0]).toMatchObject({
                    id: 1,
                    name: 'Candidate One',
                });
                expect(data?.candidates[1]).toMatchObject({
                    id: 2,
                    name: 'Candidate Two',
                });
            }

            expect(candidateRepository.getAllCandidates).toHaveBeenCalled();
        });

        it('returns empty array when no candidates', async () => {
            jest
                .spyOn(candidateRepository, 'getAllCandidates')
                .mockResolvedValue(ok([]));

            const response = await server.executeOperation(
                { query: GET_CANDIDATES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { data, errors } = body.singleResult;
                expect(errors).toBeUndefined();
                expect(data?.candidates).toEqual([]);
            }
        });

        it('returns GraphQLError with code 30002 when repository returns err', async () => {
            jest
                .spyOn(candidateRepository, 'getAllCandidates')
                .mockResolvedValue(err(ERRORS.DATABASE_ERROR));

            const response = await server.executeOperation(
                { query: GET_CANDIDATES },
                { contextValue: createContext() }
            );

            expect(response.body.kind).toBe('single');
            const body = response.body;
            if (body.kind === 'single') {
                const { errors } = body.singleResult;
                expect(errors).toHaveLength(1);
                expect(errors?.[0].message).toBe('Candidate not found');
                expect(errors?.[0].extensions?.code).toBe('30002');
            }
        });
    });
});
