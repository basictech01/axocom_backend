import { randomBytes } from "node:crypto";
import { GraphQLError } from "graphql";
import type { CertificateParticipantRow } from "../../models/certificate_participant.model";
import type { SolutionSubmissionRow } from "../../models/solution.model";
import { MAX_TEAM_MEMBERS, type TeamMemberRow } from "../../models/team_member.model";
import { certificateParticipantRepository } from "../../repositories/certificate_participant.repository";
import { solutionRepository } from "../../repositories/solution.repository";
import { teamMemberRepository } from "../../repositories/team_member.repository";
import { ERRORS } from "../../utils/error";
import { toGraphQLError } from "../context";
import createLogger from "../../utils/logger";

const logger = createLogger("@certificate-participant.resolver");

export const CERTIFICATE_REGISTRATION_DEADLINE = new Date("2026-09-18T23:59:59+05:30");

/**
 * Team entries originally recorded only the lead, so teammates had no way to get
 * a certificate. Teammates, and leads acting for them, get this later window.
 */
export const TEAMMATE_CERTIFICATE_DEADLINE = new Date("2026-09-23T16:00:00+05:30");

interface RegisterCertificateParticipantInput {
    fullName: string;
    email: string;
    phone: string;
    institution: string;
    course?: string | null;
    city: string;
}

interface CertificateParticipantView {
    id: number;
    hash: string;
    fullName: string;
    institution: string;
    course: string | null;
    city: string;
    issuedAt: Date;
}

const cleanText = (value: string) => value.trim().replace(/\s+/g, " ");
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");

function badInput(message: string): never {
    throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT", statusCode: 400 } });
}

function validateInput(input: RegisterCertificateParticipantInput) {
    const normalized = {
        fullName: cleanText(input.fullName ?? ""),
        email: normalizeEmail(input.email ?? ""),
        phone: normalizePhone(input.phone ?? ""),
        institution: cleanText(input.institution ?? ""),
        course: input.course ? cleanText(input.course) : null,
        city: cleanText(input.city ?? ""),
    };

    if (normalized.fullName.length < 2 || normalized.fullName.length > 120) badInput("Enter a valid full name");
    if (normalized.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) badInput("Enter a valid email address");
    if (!/^[6-9]\d{9}$/.test(normalized.phone)) badInput("Enter a valid 10-digit Indian mobile number");
    if (normalized.institution.length < 2 || normalized.institution.length > 180) badInput("Enter a valid institution or organisation");
    if (normalized.course && normalized.course.length > 160) badInput("Course must be 160 characters or fewer");
    if (normalized.city.length < 2 || normalized.city.length > 120) badInput("Enter a valid city");
    return normalized;
}

function validateLead(input: { leadEmail: string; leadPhone: string }) {
    const leadEmail = normalizeEmail(input.leadEmail ?? "");
    const leadPhone = normalizePhone(input.leadPhone ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) badInput("Enter a valid email address");
    if (!/^\d{10}$/.test(leadPhone)) badInput("Enter a valid 10-digit Indian mobile number");
    return { leadEmail, leadPhone };
}

function closed(deadlineLabel: string): never {
    throw new GraphQLError(`Certificate registration closed on ${deadlineLabel}`, {
        extensions: { code: "REGISTRATION_CLOSED", statusCode: 410 },
    });
}

function notRegistered(): never {
    throw new GraphQLError("You are not registered. Please register first to get a participation certificate.", {
        extensions: { code: "NOT_REGISTERED", statusCode: 403 },
    });
}

function detailsMismatch(): never {
    throw new GraphQLError("These details do not match your hackathon registration", {
        extensions: { code: "REGISTRATION_DETAILS_MISMATCH", statusCode: 403 },
    });
}

export function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    return `${local.slice(0, 2)}•••@${domain}`;
}

/** Only the person who submitted the entry, proven by email and phone, may act for the team. */
async function verifyTeamLead(input: { leadEmail: string; leadPhone: string }): Promise<SolutionSubmissionRow> {
    const { leadEmail, leadPhone } = validateLead(input);
    const lead = await solutionRepository.findByEmail(leadEmail);
    if (lead.isErr()) databaseFailure();
    if (!lead.value) {
        const member = await teamMemberRepository.findByEmail(leadEmail);
        if (member.isErr()) databaseFailure();
        if (member.value) {
            throw new GraphQLError("This email belongs to a teammate, not the team lead", {
                extensions: { code: "NOT_TEAM_LEAD", statusCode: 403 },
            });
        }
        notRegistered();
    }
    if (lead.value.normalized_phone !== leadPhone) detailsMismatch();
    return lead.value;
}

function toTeamMemberView(member: TeamMemberRow, certificate: CertificateParticipantRow | undefined) {
    return {
        id: String(member.id),
        fullName: member.full_name,
        emailHint: maskEmail(member.normalized_email),
        certificate: certificate ? toView(certificate) : null,
    };
}

function toView(row: CertificateParticipantRow): CertificateParticipantView {
    return {
        id: row.id,
        hash: row.hash,
        fullName: row.full_name,
        institution: row.institution,
        course: row.course,
        city: row.city,
        issuedAt: row.issued_at,
    };
}

function databaseFailure(): never {
    throw new GraphQLError("Certificate service is temporarily unavailable", {
        extensions: { code: "INTERNAL_SERVER_ERROR", statusCode: 500 },
    });
}

export const certificateParticipantResolvers = {
    Query: {
        certificateByEmail: async (_: unknown, { email }: { email: string }): Promise<CertificateParticipantView | null> => {
            const normalizedEmail = normalizeEmail(email ?? "");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) badInput("Enter a valid email address");
            const result = await certificateParticipantRepository.findByEmail(normalizedEmail);
            if (result.isErr()) databaseFailure();
            return result.value ? toView(result.value) : null;
        },
        certificateLookupByEmail: async (_: unknown, { email }: { email: string }) => {
            const normalizedEmail = normalizeEmail(email ?? "");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) badInput("Enter a valid email address");

            const certificate = await certificateParticipantRepository.findByEmail(normalizedEmail);
            if (certificate.isErr()) databaseFailure();
            if (certificate.value) return { registered: true, certificate: toView(certificate.value) };

            const registration = await solutionRepository.findByEmail(normalizedEmail);
            if (registration.isErr()) databaseFailure();
            if (registration.value) return { registered: true, certificate: null };

            const member = await teamMemberRepository.findByEmail(normalizedEmail);
            if (member.isErr()) databaseFailure();
            return { registered: Boolean(member.value), certificate: null };
        },
        certificateTeamByLead: async (_: unknown, { input }: { input: { leadEmail: string; leadPhone: string } }) => {
            const lead = await verifyTeamLead(input);
            const members = await teamMemberRepository.listBySubmissionIds([lead.id]);
            if (members.isErr()) databaseFailure();

            const emails = [lead.normalized_email, ...members.value.map((member) => member.normalized_email)];
            const certificates = await certificateParticipantRepository.findByEmails(emails);
            if (certificates.isErr()) databaseFailure();
            const byEmail = new Map(certificates.value.map((row) => [row.email_normalized, row]));
            const leadCertificate = byEmail.get(lead.normalized_email);

            return {
                solutionTitle: lead.solution_title,
                problemCode: lead.problem_code,
                leadName: lead.full_name,
                leadCertificate: leadCertificate ? toView(leadCertificate) : null,
                members: members.value.map((member) => toTeamMemberView(member, byEmail.get(member.normalized_email))),
                maxMembers: MAX_TEAM_MEMBERS,
            };
        },
        certificateByHash: async (_: unknown, { hash }: { hash: string }): Promise<CertificateParticipantView | null> => {
            const normalizedHash = hash?.trim() ?? "";
            if (!/^[A-Za-z0-9_-]{24,64}$/.test(normalizedHash)) return null;
            const result = await certificateParticipantRepository.findByHash(normalizedHash);
            if (result.isErr()) databaseFailure();
            return result.value ? toView(result.value) : null;
        },
    },
    Mutation: {
        registerCertificateParticipant: async (_: unknown, { input }: { input: RegisterCertificateParticipantInput }): Promise<CertificateParticipantView> => {
            const normalized = validateInput(input);
            const registration = await solutionRepository.findByEmail(normalized.email);
            if (registration.isErr()) databaseFailure();

            // Leads and solo participants keep the original deadline; teammates
            // registered on a team entry get the later teammate window.
            let registered: { full_name: string; normalized_phone: string };
            if (registration.value) {
                if (Date.now() >= CERTIFICATE_REGISTRATION_DEADLINE.getTime()) closed("18 September 2026 at 11:59 PM IST");
                registered = registration.value;
            } else {
                const member = await teamMemberRepository.findByEmail(normalized.email);
                if (member.isErr()) databaseFailure();
                if (!member.value) notRegistered();
                if (Date.now() >= TEAMMATE_CERTIFICATE_DEADLINE.getTime()) closed("23 September 2026 at 4:00 PM IST");
                registered = member.value;
            }
            if (registered.normalized_phone !== normalized.phone) detailsMismatch();

            const result = await certificateParticipantRepository.create({
                ...normalized,
                fullName: registered.full_name,
                hash: randomBytes(24).toString("base64url"),
            });
            if (result.isErr()) {
                if (result.error === ERRORS.DUPLICATE_RESOURCE) {
                    throw new GraphQLError("A certificate already exists for this email address or mobile number", {
                        extensions: { code: "DUPLICATE_RESOURCE", statusCode: 409 },
                    });
                }
                logger.error("Error registering certificate participant", result.error);
                databaseFailure();
            }
            return toView(result.value);
        },
        addCertificateTeamMember: async (
            _: unknown,
            { input }: { input: RegisterCertificateParticipantInput & { leadEmail: string; leadPhone: string } },
        ) => {
            if (Date.now() >= TEAMMATE_CERTIFICATE_DEADLINE.getTime()) closed("23 September 2026 at 4:00 PM IST");

            const member = validateInput(input);
            const lead = await verifyTeamLead(input);
            if (member.email === lead.normalized_email || member.phone === lead.normalized_phone) {
                badInput("A teammate needs their own email address and mobile number");
            }

            const result = await teamMemberRepository.addWithCertificate({
                submissionId: lead.id,
                member: { fullName: member.fullName, email: member.email, phone: member.phone },
                certificate: {
                    hash: randomBytes(24).toString("base64url"),
                    institution: member.institution,
                    course: member.course,
                    city: member.city,
                },
            });
            if (result.isErr()) {
                if (result.error === ERRORS.DUPLICATE_RESOURCE) {
                    throw new GraphQLError("A certificate already exists for this email address or mobile number", {
                        extensions: { code: "DUPLICATE_RESOURCE", statusCode: 409 },
                    });
                }
                if (result.error === ERRORS.DATABASE_ERROR) databaseFailure();
                throw toGraphQLError(result.error);
            }
            return toTeamMemberView(result.value.member, result.value.certificate);
        },
    },
};
