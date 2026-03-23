import { GraphQLError } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import { Voter } from '../../models/voter.model';
import {
    voterRepository,
    type PaginatedVoterResult,
    type VoterFilterOptionsResult,
} from '../../repositories/voter.repository';
import createLogger from '../../utils/logger';

const logger = createLogger('@voter.resolver');

export const voterResolvers = {
    // Scalar resolvers
    DateTime: DateTimeResolver,

    Query: {
        voter: async (_: any, { id }: { id: number }): Promise<Voter | null> => {
            const result = await voterRepository.getById(id);

            if (result.isErr()) {
                logger.error('Error fetching voter:', result.error);
                throw new GraphQLError('Failed to fetch voter', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },

        voters: async (): Promise<Voter[]> => {
            const result = await voterRepository.getAll();

            if (result.isErr()) {
                logger.error('Error fetching voters:', result.error);
                throw new GraphQLError('Failed to fetch voters', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },
        voterAgeBucketsByState: async (
            _: any,
            { state }: { state: string }
        ): Promise<{ group: string; total: number }[]> => {
            const result = await voterRepository.getAgeBucketsByState(state);

            if (result.isErr()) {
                logger.error("Error fetching voter age buckets:", result.error);
                throw new GraphQLError("Failed to fetch voter age buckets", {
                    extensions: { code: "INTERNAL_SERVER_ERROR" },
                });
            }

            // Map DB row shape to GraphQL field names
            return result.value.map((row) => ({
                group: row.age_group,
                total: row.total,
            }));
        },

        voterFilterOptions: async (): Promise<VoterFilterOptionsResult> => {
            const result = await voterRepository.getFilterOptions();

            if (result.isErr()) {
                logger.error('Error fetching voter filter options:', result.error);
                throw new GraphQLError('Failed to fetch voter filter options', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },

        votersPaginated: async (
            _: any,
            args: {
                page?: number;
                limit?: number;
                search?: string;
                assembly_constituency?: string;
                parliamentary_constituency?: string;
            }
        ): Promise<PaginatedVoterResult> => {
            const page = args.page ?? 1;
            const limit = args.limit ?? 10;

            const result = await voterRepository.getPaginated({
                page,
                limit,
                search: args.search ?? null,
                assembly_constituency: args.assembly_constituency ?? null,
                parliamentary_constituency: args.parliamentary_constituency ?? null,
            });

            if (result.isErr()) {
                logger.error('Error fetching paginated voters:', result.error);
                throw new GraphQLError('Failed to fetch voters', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },
    },
};