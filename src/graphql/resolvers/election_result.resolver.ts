import { GraphQLError } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import createLogger from '../../utils/logger';
import { ElectionResult } from '../../models/election_result.model';
import { electionResultRepository } from '../../repositories/election_result.repository';

const logger = createLogger('@election_result.resolver');

export const electionResultResolvers = {
    // Scalar resolvers
    DateTime: DateTimeResolver,

    Query: {
        election_result: async (_: any, { id }: { id: number }): Promise<ElectionResult | null> => {
            const result = await electionResultRepository.getById(id);

            if (result.isErr()) {
                logger.error('Error fetching election result:', result.error);
                throw new GraphQLError('Failed to fetch election result', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },

        election_results: async (): Promise<ElectionResult[]> => {
            const result = await electionResultRepository.getAll();

            if (result.isErr()) {
                logger.error('Error fetching election results:', result.error);
                throw new GraphQLError('Failed to fetch election results', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },

        constituency_results: async (_: any, { constituency_id, election_year }: { constituency_id: number; election_year: number }) => {
            const result = await electionResultRepository.getByConstituencyIdAndYear(constituency_id, election_year);
            if (result.isErr()) {
                throw new GraphQLError('Failed to fetch constituency results', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }
            return result.value;
        },
    },
};