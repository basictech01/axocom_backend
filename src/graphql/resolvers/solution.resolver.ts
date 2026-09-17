import type { GraphQLContext } from "../context";
import { requireAdmin, toGraphQLError } from "../context";
import { mentorRepository } from "../../repositories/mentor.repository";
import { solutionRepository } from "../../repositories/solution.repository";
import type { ReviewStatus } from "../../models/solution.model";
import { createTeamDashboardToken, decodeTeamDashboardToken } from "../../utils/jwt";
import { normalizeEmail, normalizePhone } from "../../utils/normalize";
import { RequestError } from "../../utils/error";

function mapPublicSolution(row: Record<string, unknown>) {
    return {
        id: row.id,
        fullName: row.full_name,
        problemCode: row.problem_code,
        solutionTitle: row.solution_title,
        solutionDescription: row.solution_description,
        prototypeUrl: row.prototype_url,
        createdAt: row.created_at,
        status: row.status,
    };
}

function mapAdminSolution(row: Record<string, unknown>) {
    return {
        ...mapPublicSolution(row),
        email: row.email,
        phone: row.phone,
        contactConsentAt: row.contact_consent_at,
        adminNote: row.admin_note,
        reviewedAt: row.reviewed_at,
        reviewedByAdminId: row.reviewed_by_admin_id,
        updatedAt: row.updated_at,
    };
}

function mapSolutionStatus(row: Record<string, unknown>) {
    return {
        id: row.id,
        problemCode: row.problem_code,
        solutionTitle: row.solution_title,
        status: row.status,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapTeamMember(row: Record<string, unknown>) {
    return {
        id: String(row.id),
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        createdAt: row.created_at,
    };
}

function readTeamDashboardToken(accessToken: string) {
    try {
        return decodeTeamDashboardToken(accessToken);
    } catch (error) {
        if (error instanceof RequestError) throw toGraphQLError(error);
        throw error;
    }
}

function mapTeamDashboard(solution: Record<string, unknown>, members: Record<string, unknown>[], accessToken: string) {
    return {
        accessToken,
        id: solution.id,
        fullName: solution.full_name,
        email: solution.email,
        phone: solution.phone,
        problemCode: solution.problem_code,
        solutionTitle: solution.solution_title,
        solutionDescription: solution.solution_description,
        prototypeUrl: solution.prototype_url,
        status: solution.status,
        createdAt: solution.created_at,
        updatedAt: solution.updated_at,
        members: members.map(mapTeamMember),
    };
}

export const solutionResolvers = {
    Query: {
        publicSolutions: async (_: unknown, args: { problemCode?: string; page?: number; limit?: number }) => {
            const result = await solutionRepository.listPublic(args);
            if (result.isErr()) throw toGraphQLError(result.error);
            return {
                data: result.value.data.map((row) => mapPublicSolution(row as unknown as Record<string, unknown>)),
                pagination: result.value.pagination,
            };
        },

        publicStats: async () => {
            const solutions = await solutionRepository.countAccepted();
            if (solutions.isErr()) throw toGraphQLError(solutions.error);

            const mentors = await mentorRepository.countAccepted();
            if (mentors.isErr()) throw toGraphQLError(mentors.error);

            return { acceptedSolutions: solutions.value, acceptedMentors: mentors.value };
        },

        solutionStatus: async (_: unknown, args: { contact: string }) => {
            const result = await solutionRepository.findStatusByContact(args.contact);
            if (result.isErr()) throw toGraphQLError(result.error);
            return result.value
                ? mapSolutionStatus(result.value as unknown as Record<string, unknown>)
                : null;
        },

        teamDashboard: async (_: unknown, args: { accessToken: string }) => {
            const credentials = readTeamDashboardToken(args.accessToken);
            const result = await solutionRepository.findTeamDashboard(credentials.email, credentials.phone);
            if (result.isErr()) throw toGraphQLError(result.error);
            return mapTeamDashboard(
                result.value.solution as unknown as Record<string, unknown>,
                result.value.members as unknown as Record<string, unknown>[],
                args.accessToken
            );
        },

        adminSolutionSubmissions: async (
            _: unknown,
            args: { status?: ReviewStatus; search?: string; problemCode?: string; page?: number; limit?: number },
            context: GraphQLContext
        ) => {
            requireAdmin(context);
            const result = await solutionRepository.listAdmin(args);
            if (result.isErr()) throw toGraphQLError(result.error);
            return {
                data: result.value.data.map((row) => mapAdminSolution(row as unknown as Record<string, unknown>)),
                pagination: result.value.pagination,
            };
        },

        adminSolutionSubmission: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
            requireAdmin(context);
            const submission = await context.loaders.solutionById.load(args.id);
            return submission ? mapAdminSolution(submission as unknown as Record<string, unknown>) : null;
        },
    },

    Mutation: {
        submitSolution: async (_: unknown, args: { input: Parameters<typeof solutionRepository.create>[0] }) => {
            const result = await solutionRepository.create(args.input);
            if (result.isErr()) throw toGraphQLError(result.error);
            return {
                ...result.value,
                accessToken: createTeamDashboardToken({
                    scope: "team-dashboard",
                    solutionId: result.value.submissionId,
                    email: normalizeEmail(args.input.email),
                    phone: normalizePhone(args.input.phone) ?? "",
                }),
            };
        },

        openTeamLeaderDashboard: async (_: unknown, args: { email: string; phone: string }) => {
            const result = await solutionRepository.findTeamDashboard(args.email, args.phone);
            if (result.isErr()) throw toGraphQLError(result.error);
            const accessToken = createTeamDashboardToken({
                scope: "team-dashboard",
                solutionId: result.value.solution.id,
                email: result.value.solution.normalized_email,
                phone: result.value.solution.normalized_phone,
            });
            return mapTeamDashboard(
                result.value.solution as unknown as Record<string, unknown>,
                result.value.members as unknown as Record<string, unknown>[],
                accessToken
            );
        },

        updateTeamSolution: async (
            _: unknown,
            args: { accessToken: string; input: Parameters<typeof solutionRepository.updateByTeamLeader>[2] }
        ) => {
            const credentials = readTeamDashboardToken(args.accessToken);
            const result = await solutionRepository.updateByTeamLeader(credentials.email, credentials.phone, args.input);
            if (result.isErr()) throw toGraphQLError(result.error);
            return true;
        },

        addSolutionTeamMember: async (
            _: unknown,
            args: { accessToken: string; input: Parameters<typeof solutionRepository.addTeamMember>[2] }
        ) => {
            const credentials = readTeamDashboardToken(args.accessToken);
            const result = await solutionRepository.addTeamMember(credentials.email, credentials.phone, args.input);
            if (result.isErr()) throw toGraphQLError(result.error);
            return mapTeamMember(result.value as unknown as Record<string, unknown>);
        },

        updateSolutionStatus: async (
            _: unknown,
            args: { id: string; input: { status: ReviewStatus; adminNote?: string | null } },
            context: GraphQLContext
        ) => {
            const admin = requireAdmin(context);
            const result = await solutionRepository.updateStatus(
                args.id,
                args.input.status,
                args.input.adminNote,
                admin.id
            );
            if (result.isErr()) throw toGraphQLError(result.error);
            return true;
        },
    },
};