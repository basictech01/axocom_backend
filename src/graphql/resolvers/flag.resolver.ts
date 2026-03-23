import { GraphQLError } from "graphql";
import { flagRepository } from "../../repositories/flag.repository";
import { FlagRow } from "../../models/flag.model";
import createLogger from "../../utils/logger";

const logger = createLogger("@flag.resolver");

export const flagResolvers = {
    Mutation: {
        submitFlagData: async (
            _: unknown,
            { data }: { data: string }
        ): Promise<FlagRow> => {
            // Validate that the supplied string is valid JSON before persisting.
            try {
                JSON.parse(data);
            } catch {
                throw new GraphQLError("data must be a valid JSON string", {
                    extensions: { code: "BAD_USER_INPUT" },
                });
            }

            const result = await flagRepository.create(data);

            if (result.isErr()) {
                logger.error("Error saving flag data:", result.error);
                throw new GraphQLError("Failed to save flag data", {
                    extensions: { code: "INTERNAL_SERVER_ERROR" },
                });
            }

            return result.value;
        },
    },
};
