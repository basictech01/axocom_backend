import { GraphQLError } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import createLogger from '../../utils/logger';
import { Constituency } from '../../models/constituency.model';
import { constituencyRepository } from '../../repositories/constituency.repository';

const logger = createLogger('@constituency.resolver');

export const constituencyResolvers = {
    // Scalar resolvers
    DateTime: DateTimeResolver,

    Query: {
        constituency: async (_: any, { id }: { id: number }): Promise<Constituency | null> => {
            const result = await constituencyRepository.getById(id);

            if (result.isErr()) {
                logger.error('Error fetching constituency:', result.error);
                throw new GraphQLError('Failed to fetch constituency', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },

        constituencies: async (): Promise<Constituency[]> => {
            const result = await constituencyRepository.getAll();

            if (result.isErr()) {
                logger.error('Error fetching constituencies:', result.error);
                throw new GraphQLError('Failed to fetch constituencies', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },
        constituenciesByState: async (_: any, { state }: { state: string }): Promise<Constituency[]> => {
            const result = await constituencyRepository.getByState(state);
            if (result.isErr()) {
                logger.error('Error fetching constituencies by state:', result.error);
                throw new GraphQLError('Failed to fetch constituencies by state', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }
            return result.value;
        },
    },
};