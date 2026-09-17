import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { err, ok } from "neverthrow";
import { ERRORS } from "../../utils/error";
import type { CertificateParticipantRow } from "../../models/certificate_participant.model";
import { certificateParticipantRepository } from "../../repositories/certificate_participant.repository";
import { solutionRepository } from "../../repositories/solution.repository";
import { certificateParticipantResolvers } from "./certificate_participant.resolver";

const row = {
    id: 1,
    hash: "abcdefghijklmnopqrstuvwxyzABCDEF",
    full_name: "Sample Student",
    email_normalized: "student@example.com",
    phone_normalized: "9876543210",
    institution: "Example University",
    course: "Computer Science",
    city: "Dehradun",
    issued_at: new Date("2026-09-11T10:00:00.000Z"),
    created_at: new Date("2026-09-11T10:00:00.000Z"),
} as CertificateParticipantRow;

describe("certificate participant resolvers", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(solutionRepository, "findByEmail").mockResolvedValue(ok({
            id: "registered-submission",
            full_name: "Sample Student",
            email: "student@example.com",
            normalized_email: "student@example.com",
            phone: "9876543210",
            normalized_phone: "9876543210",
            problem_code: "UKIS-01",
            solution_title: "Test solution",
            solution_description: "A detailed test solution",
            prototype_url: null,
            contact_consent_at: new Date("2026-09-10T10:00:00.000Z"),
            status: "pending",
            admin_note: null,
            reviewed_at: null,
            reviewed_by_admin_id: null,
            created_at: new Date("2026-09-10T10:00:00.000Z"),
            updated_at: new Date("2026-09-10T10:00:00.000Z"),
        } as never));
    });

    it("returns null for an email without a registration", async () => {
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        await expect(
            certificateParticipantResolvers.Query.certificateByEmail(null, { email: "missing@example.com" }),
        ).resolves.toBeNull();
    });

    it("distinguishes an unregistered email and generates a missing certificate", async () => {
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        const create = jest.spyOn(certificateParticipantRepository, "create").mockResolvedValue(ok(row));
        const registrationLookup = jest.spyOn(solutionRepository, "findByEmail");

        registrationLookup.mockResolvedValueOnce(ok(null));
        await expect(
            certificateParticipantResolvers.Mutation.certificateLookupByEmail(null, { email: "missing@example.com" }),
        ).resolves.toEqual({ registered: false, certificate: null });

        registrationLookup.mockResolvedValueOnce(ok({
            full_name: "Sample Student",
            normalized_email: "student@example.com",
            normalized_phone: "9876543210",
        } as never));
        await expect(
            certificateParticipantResolvers.Mutation.certificateLookupByEmail(null, { email: "student@example.com" }),
        ).resolves.toEqual({ registered: true, certificate: expect.objectContaining({ hash: row.hash }) });
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            fullName: "Sample Student",
            email: "student@example.com",
            phone: "9876543210",
            institution: null,
            city: null,
        }));
    });

    it("rejects certificate creation for an email without a hackathon registration", async () => {
        jest.spyOn(solutionRepository, "findByEmail").mockResolvedValue(ok(null));
        const create = jest.spyOn(certificateParticipantRepository, "create");

        await expect(
            certificateParticipantResolvers.Mutation.registerCertificateParticipant(null, {
                input: {
                    fullName: "Unknown Student",
                    email: "missing@example.com",
                    phone: "9876543210",
                    institution: "Example University",
                    city: "Dehradun",
                },
            }),
        ).rejects.toMatchObject({ extensions: { code: "NOT_REGISTERED" } });
        expect(create).not.toHaveBeenCalled();
    });

    it("normalizes input, hides contact data, and creates a secure token", async () => {
        const create = jest.spyOn(certificateParticipantRepository, "create")
            .mockImplementation(async (input) => ok({ ...row, hash: input.hash }));
        const result = await certificateParticipantResolvers.Mutation.registerCertificateParticipant(null, {
            input: {
                fullName: "  Sample   Student ", email: " Student@Example.COM ",
                phone: "+91 98765 43210", institution: " Example University ",
                course: " Computer Science ", city: " Dehradun ",
            },
        });

        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            fullName: "Sample Student", email: "student@example.com", phone: "9876543210",
        }));
        expect(result.hash).toMatch(/^[A-Za-z0-9_-]{32}$/);
        expect(result).not.toHaveProperty("email");
        expect(result).not.toHaveProperty("phone");
    });

    it("accepts a registration without optional institution and city details", async () => {
        const create = jest.spyOn(certificateParticipantRepository, "create")
            .mockImplementation(async (input) => ok({ ...row, hash: input.hash }));

        await certificateParticipantResolvers.Mutation.registerCertificateParticipant(null, {
            input: { fullName: "Sample Student", email: "student@example.com", phone: "9876543210" },
        });

        expect(create).toHaveBeenCalledWith(expect.objectContaining({ institution: null, city: null, course: null }));
    });

    it("returns a stable error for duplicates", async () => {
        jest.spyOn(certificateParticipantRepository, "create")
            .mockResolvedValue(err(ERRORS.DUPLICATE_RESOURCE));
        const input = {
            fullName: "Sample Student", email: "student@example.com", phone: "9876543210",
            institution: "Example University", city: "Dehradun",
        };
        await expect(
            certificateParticipantResolvers.Mutation.registerCertificateParticipant(null, { input }),
        ).rejects.toMatchObject({ extensions: { code: "DUPLICATE_RESOURCE" } });
    });
});
