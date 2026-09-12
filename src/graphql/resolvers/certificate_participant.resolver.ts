import { randomBytes } from "node:crypto";
import { GraphQLError } from "graphql";
import type { CertificateParticipantRow } from "../../models/certificate_participant.model";
import { certificateParticipantRepository } from "../../repositories/certificate_participant.repository";
import { solutionRepository } from "../../repositories/solution.repository";
import { ERRORS } from "../../utils/error";
import createLogger from "../../utils/logger";

const logger = createLogger("@certificate-participant.resolver");

export const CERTIFICATE_REGISTRATION_DEADLINE = new Date("2026-09-15T16:00:00+05:30");

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
            return { registered: Boolean(registration.value), certificate: null };
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
            if (Date.now() >= CERTIFICATE_REGISTRATION_DEADLINE.getTime()) {
                throw new GraphQLError("Certificate registration closed on 15 September 2026 at 4:00 PM IST", {
                    extensions: { code: "REGISTRATION_CLOSED", statusCode: 410 },
                });
            }

            const normalized = validateInput(input);
            const registration = await solutionRepository.findByEmail(normalized.email);
            if (registration.isErr()) databaseFailure();
            if (!registration.value) {
                throw new GraphQLError("You are not registered. Please register first to get a participation certificate.", {
                    extensions: { code: "NOT_REGISTERED", statusCode: 403 },
                });
            }
            if (registration.value.normalized_phone !== normalized.phone) {
                throw new GraphQLError("These details do not match your hackathon registration", {
                    extensions: { code: "REGISTRATION_DETAILS_MISMATCH", statusCode: 403 },
                });
            }
            const result = await certificateParticipantRepository.create({
                ...normalized,
                fullName: registration.value.full_name,
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
    },
};
