import { GraphQLError } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import createLogger from '../../utils/logger';
import { Election } from '../../models/election.model';
import { electionRepository } from '../../repositories/election.repository';

const logger = createLogger('@election.resolver');

export const electionResolvers = {
    // Scalar resolvers
    DateTime: DateTimeResolver,

    Query: {
        election: async (_: any, { id }: { id: number }): Promise<Election | null> => {
            const result = await electionRepository.getById(id);

            if (result.isErr()) {
                logger.error('Error fetching election:', result.error);
                throw new GraphQLError('Failed to fetch election', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },

        elections: async (): Promise<Election[]> => {
            const result = await electionRepository.getAll();

            if (result.isErr()) {
                logger.error('Error fetching elections:', result.error);
                throw new GraphQLError('Failed to fetch elections', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },

        electionByConstituencyAndYear: async (
            _: any,
            { constituency_id, year }: { constituency_id: number; year: number }
        ): Promise<Election | null> => {
            const result = await electionRepository.getByConstituencyIdAndYear(constituency_id, year);
            if (result.isErr()) {
                logger.error('Error fetching election:', result.error);
                throw new GraphQLError('Failed to fetch election by constituency and year', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }
            return result.value;
        },

        electionsByConstituencyId: async (
            _: any,
            { constituency_id }: { constituency_id: number }
        ): Promise<Election[]> => {
            const result = await electionRepository.getByConstituencyId(constituency_id);
            if (result.isErr()) {
                logger.error('Error fetching elections by constituency:', result.error);
                throw new GraphQLError('Failed to fetch elections by constituency', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }
            return result.value;
        },
    },
};