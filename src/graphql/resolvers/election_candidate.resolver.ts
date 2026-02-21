import { GraphQLError } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import createLogger from '../../utils/logger';
import { electionCandidateRepository } from '../../repositories/election_candidate.repository';
import { ElectionCandidate } from '../../models/election_candidate.model';
import { GraphQLContext } from '../context';
import { ElectionResult } from '../../models/election_result.model';

const logger = createLogger('@election_candidate.resolver');

export const electionCandidateResolvers = {
    // Scalar resolvers
    DateTime: DateTimeResolver,

    // Field resolvers
    ElectionCandidate: {
        candidate: (parent: ElectionCandidate, _: any, context: GraphQLContext) => {
            return context.loaders.candidateLoader.load(parent.candidate_id);
        },
        party: (parent: ElectionCandidate, _: any, context: GraphQLContext) => {
            return context.loaders.partyLoader.load(parent.party_id);
        },
    },

    ElectionResult: {
        election_candidate: (parent: ElectionResult, _: any, context: GraphQLContext) => {
            return context.loaders.electionCandidateLoader.load(parent.election_candidate_id);
        },
    },

    Query: {
        election_candidate: async (_: any, { id }: { id: number }): Promise<ElectionCandidate | null> => {
            const result = await electionCandidateRepository.getById(id);

            if (result.isErr()) {
                logger.error('Error fetching election candidate:', result.error);
                throw new GraphQLError('Failed to fetch election candidate', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },

        election_candidates: async (): Promise<ElectionCandidate[]> => {
            const result = await electionCandidateRepository.getAll();

            if (result.isErr()) {
                logger.error('Error fetching election candidates:', result.error);
                throw new GraphQLError('Failed to fetch election candidates', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }

            return result.value;
        },
        constituency_candidates: async (_: any, { constituency_id, election_year }: { constituency_id: number; election_year: number }) => {
            const result = await electionCandidateRepository.getByConstituencyAndYear(constituency_id, election_year);
            if (result.isErr()) {
                throw new GraphQLError('Failed to fetch constituency candidates', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }
            return result.value;
        },

        candidate_elections: async (_: any, { candidate_id }: { candidate_id: number }): Promise<ElectionCandidate[]> => {
            const result = await electionCandidateRepository.getByCandidateId(candidate_id);
            if (result.isErr()) {
                throw new GraphQLError('Failed to fetch candidate elections', {
                    extensions: { code: 'INTERNAL_SERVER_ERROR' },
                });
            }
            return result.value;
        },
    },
};