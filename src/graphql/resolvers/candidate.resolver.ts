import { GraphQLError } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import GraphQLJSON from 'graphql-type-json';
import { Candidate } from '../../models/candidate.model';
import { candidateRepository } from '../../repositories/candidate.repository';
import createLogger from '../../utils/logger';
import { requireAuth } from '../context';
import type { GraphQLContext } from '../context'


const logger = createLogger('@candidate.resolver');

export const candidateResolvers = {
  // Scalar resolvers
  JSON: GraphQLJSON,
  DateTime: DateTimeResolver,

  Query: {
    candidate: async (_: any, { id }: { id: number }, context: GraphQLContext): Promise<Candidate | null> => {
      requireAuth(context);
      const result = await candidateRepository.getById(id);

      if (result.isErr()) {
        logger.error('Error fetching candidate:', result.error);
        throw new GraphQLError('Candidate not found', {
          extensions: { code: '30001' },
        });
      }

      return result.value;
    },

    candidates: async (): Promise<Candidate[]> => {
      const result = await candidateRepository.getAllCandidates();

      if (result.isErr()) {
        logger.error('Error fetching candidates:', result.error);
        throw new GraphQLError('Candidate not found', {
          extensions: { code: '30002' },
        });
      }

      return result.value;
    },
  },
};