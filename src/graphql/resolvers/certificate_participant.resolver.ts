import { randomBytes } from "node:crypto";
import { GraphQLError } from "graphql";
import type { CertificateParticipantRow } from "../../models/certificate_participant.model";
import { certificateParticipantRepository } from "../../repositories/certificate_participant.repository";
import { solutionRepository } from "../../repositories/solution.repository";
import { ERRORS, type RequestError } from "../../utils/error";
import createLogger from "../../utils/logger";
import { toGraphQLError } from "../context";

const logger = createLogger("@certificate-participant.resolver");

interface RegisterCertificateParticipantInput {
    fullName: string;
    email: string;
    phone: string;
    institution?: string | null;
    course?: string | null;
    city?: string | null;
}

interface CertificateParticipantView {
    id: number;
    hash: string;
    fullName: string;
    institution: string | null;
    course: string | null;
    city: string | null;
    issuedAt: Date;
}

const cleanText = (value: string) => value.trim().replace(/\s+/g, " ");
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");

function badInput(message: string): never {
    throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT", statusCode: 400 } });
}

function optionalText(value: string | null | undefined) {
    const cleaned = cleanText(value ?? "");
    return cleaned.length > 0 ? cleaned : null;
}

function validateInput(input: RegisterCertificateParticipantInput) {
    const normalized = {
        fullName: cleanText(input.fullName ?? ""),
        email: normalizeEmail(input.email ?? ""),
        phone: normalizePhone(input.phone ?? ""),
        institution: optionalText(input.institution),
        course: optionalText(input.course),
        city: optionalText(input.city),
    };

    if (normalized.fullName.length < 2 || normalized.fullName.length > 120) badInput("Enter a valid full name");
    if (normalized.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) badInput("Enter a valid email address");
    if (!/^[6-9]\d{9}$/.test(normalized.phone)) badInput("Enter a valid 10-digit Indian mobile number");
    if (normalized.institution && (normalized.institution.length < 2 || normalized.institution.length > 180)) badInput("Enter a valid institution or organisation");
    if (normalized.course && normalized.course.length > 160) badInput("Course must be 160 characters or fewer");
    if (normalized.city && (normalized.city.length < 2 || normalized.city.length > 120)) badInput("Enter a valid city");
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

function repositoryFailure(operation: string, error: RequestError): never {
    logger.error(`Certificate ${operation} failed`, error);
    // Client-actionable failures (404/409/...) keep their own message; only infra faults are masked.
    if (error.statusCode < 500) throw toGraphQLError(error);
    throw new GraphQLError("Certificate service is temporarily unavailable. Please try again in a moment.", {
        extensions: { code: "SERVICE_UNAVAILABLE", statusCode: 503, errorCode: error.code },
    });
}

export const certificateParticipantResolvers = {
    Query: {
        certificateByEmail: async (_: unknown, { email }: { email: string }): Promise<CertificateParticipantView | null> => {
            const normalizedEmail = normalizeEmail(email ?? "");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) badInput("Enter a valid email address");
            const result = await certificateParticipantRepository.findByEmail(normalizedEmail);
            if (result.isErr()) repositoryFailure("lookup by email", result.error);
            return result.value ? toView(result.value) : null;
        },
        certificateByHash: async (_: unknown, { hash }: { hash: string }): Promise<CertificateParticipantView | null> => {
            const normalizedHash = hash?.trim() ?? "";
            if (!/^[A-Za-z0-9_-]{24,64}$/.test(normalizedHash)) return null;
            const result = await certificateParticipantRepository.findByHash(normalizedHash);
            if (result.isErr()) repositoryFailure("lookup by hash", result.error);
            return result.value ? toView(result.value) : null;
        },
    },
    Mutation: {
        certificateLookupByEmail: async (_: unknown, { email }: { email: string }) => {
            const normalizedEmail = normalizeEmail(email ?? "");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) badInput("Enter a valid email address");

            const certificate = await certificateParticipantRepository.findByEmail(normalizedEmail);
            if (certificate.isErr()) repositoryFailure("lookup by email", certificate.error);
            if (certificate.value) return { registered: true, certificate: toView(certificate.value) };

            const registration = await solutionRepository.findByEmail(normalizedEmail);
            if (registration.isErr()) repositoryFailure("registration lookup", registration.error);
            if (!registration.value) return { registered: false, certificate: null };

            const created = await certificateParticipantRepository.create({
                hash: randomBytes(24).toString("base64url"),
                fullName: registration.value.full_name,
                email: registration.value.normalized_email,
                phone: registration.value.normalized_phone,
                institution: null,
                course: null,
                city: null,
            });
            if (created.isOk()) return { registered: true, certificate: toView(created.value) };

            if (created.error === ERRORS.DUPLICATE_RESOURCE) {
                const existing = await certificateParticipantRepository.findByEmailOrPhone(
                    normalizedEmail,
                    registration.value.normalized_phone,
                );
                if (existing.isOk() && existing.value) {
                    return { registered: true, certificate: toView(existing.value) };
                }
            }
            repositoryFailure("generation", created.error);
        },
        registerCertificateParticipant: async (_: unknown, { input }: { input: RegisterCertificateParticipantInput }): Promise<CertificateParticipantView> => {
            const normalized = validateInput(input);
            const registration = await solutionRepository.findByEmail(normalized.email);
            if (registration.isErr()) repositoryFailure("registration lookup", registration.error);
            if (!registration.value) {
                throw new GraphQLError("No accepted hackathon registration matches this email address. Certificates are issued once a submission has been accepted.", {
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
                        extensions: { code: "DUPLICATE_RESOURCE", statusCode: 409, errorCode: ERRORS.DUPLICATE_RESOURCE.code },
                    });
                }
                repositoryFailure("registration", result.error);
            }
            return toView(result.value);
        },
    },
};
