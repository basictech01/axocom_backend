import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { err, ok } from "neverthrow";
import { ERRORS } from "../../utils/error";
import type { CertificateParticipantRow } from "../../models/certificate_participant.model";
import { certificateParticipantRepository } from "../../repositories/certificate_participant.repository";
import { solutionRepository } from "../../repositories/solution.repository";
import { teamMemberRepository } from "../../repositories/team_member.repository";
import type { TeamMemberRow } from "../../models/team_member.model";
import { certificateParticipantResolvers, maskEmail } from "./certificate_participant.resolver";

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

const teammate = {
    id: 7,
    submission_id: "registered-submission",
    full_name: "Dev Negi",
    email: "dev@example.com",
    normalized_email: "dev@example.com",
    phone: "9123456789",
    normalized_phone: "9123456789",
    added_by: "registration",
    created_at: new Date("2026-09-10T10:00:00.000Z"),
} as TeamMemberRow;

const leadInput = { leadEmail: " Student@Example.com ", leadPhone: "+91 98765 43210" };
const teammateInput = {
    ...leadInput,
    fullName: "Dev Negi", email: "dev@example.com", phone: "9123456789",
    institution: "Example University", city: "Dehradun",
};

describe("certificate participant resolvers", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-09-11T10:00:00.000Z"));
        jest.spyOn(teamMemberRepository, "findByEmail").mockResolvedValue(ok(null));
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

    it("distinguishes an unregistered email from a registered email without a certificate", async () => {
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        const registrationLookup = jest.spyOn(solutionRepository, "findByEmail");

        registrationLookup.mockResolvedValueOnce(ok(null));
        await expect(
            certificateParticipantResolvers.Query.certificateLookupByEmail(null, { email: "missing@example.com" }),
        ).resolves.toEqual({ registered: false, certificate: null });

        registrationLookup.mockResolvedValueOnce(ok({} as never));
        await expect(
            certificateParticipantResolvers.Query.certificateLookupByEmail(null, { email: "student@example.com" }),
        ).resolves.toEqual({ registered: true, certificate: null });
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

    it("returns stable errors for duplicates and the deadline", async () => {
        const create = jest.spyOn(certificateParticipantRepository, "create")
            .mockResolvedValue(err(ERRORS.DUPLICATE_RESOURCE));
        const input = {
            fullName: "Sample Student", email: "student@example.com", phone: "9876543210",
            institution: "Example University", city: "Dehradun",
        };
        await expect(
            certificateParticipantResolvers.Mutation.registerCertificateParticipant(null, { input }),
        ).rejects.toMatchObject({ extensions: { code: "DUPLICATE_RESOURCE" } });

        jest.clearAllMocks();
        jest.setSystemTime(new Date("2026-09-15T16:00:00+05:30"));
        await expect(
            certificateParticipantResolvers.Mutation.registerCertificateParticipant(null, { input }),
        ).rejects.toMatchObject({ extensions: { code: "REGISTRATION_CLOSED" } });
        expect(create).not.toHaveBeenCalled();
    });
});

afterAll(async () => {
    jest.useRealTimers();
});

describe("team certificates", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.useFakeTimers();
        // After individual registration closed, inside the teammate window.
        jest.setSystemTime(new Date("2026-09-16T12:00:00+05:30"));
        jest.spyOn(solutionRepository, "findByEmail").mockImplementation(async (email) => ok(
            email === "student@example.com"
                ? {
                    id: "registered-submission", full_name: "Sample Student",
                    normalized_email: "student@example.com", normalized_phone: "9876543210",
                    problem_code: "P-001", solution_title: "Mountain Link",
                } as never
                : null,
        ));
        jest.spyOn(teamMemberRepository, "findByEmail").mockImplementation(async (email) => ok(
            email === teammate.normalized_email ? teammate : null,
        ));
    });

    it("treats a registered teammate's email as registered", async () => {
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        await expect(
            certificateParticipantResolvers.Query.certificateLookupByEmail(null, { email: "DEV@example.com" }),
        ).resolves.toEqual({ registered: true, certificate: null });
    });

    it("lets a registered teammate generate their own certificate in the teammate window", async () => {
        const create = jest.spyOn(certificateParticipantRepository, "create")
            .mockImplementation(async (input) => ok({ ...row, full_name: input.fullName, hash: input.hash }));

        const result = await certificateParticipantResolvers.Mutation.registerCertificateParticipant(null, {
            input: { fullName: "Typed Name", email: "dev@example.com", phone: "9123456789", institution: "Example University", city: "Dehradun" },
        });

        expect(create).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Dev Negi" }));
        expect(result.fullName).toBe("Dev Negi");
    });

    it("keeps individual registration closed for leads after their deadline", async () => {
        const create = jest.spyOn(certificateParticipantRepository, "create");
        await expect(
            certificateParticipantResolvers.Mutation.registerCertificateParticipant(null, {
                input: { fullName: "Sample Student", email: "student@example.com", phone: "9876543210", institution: "Example University", city: "Dehradun" },
            }),
        ).rejects.toMatchObject({ extensions: { code: "REGISTRATION_CLOSED" } });
        expect(create).not.toHaveBeenCalled();
    });

    it("returns the verified lead's team with masked teammate emails", async () => {
        jest.spyOn(teamMemberRepository, "listBySubmissionIds").mockResolvedValue(ok([teammate]));
        const findCertificates = jest.spyOn(certificateParticipantRepository, "findByEmails")
            .mockResolvedValue(ok([{ ...row, email_normalized: "dev@example.com" } as CertificateParticipantRow]));

        const team = await certificateParticipantResolvers.Query.certificateTeamByLead(null, { input: leadInput });

        expect(findCertificates).toHaveBeenCalledWith(["student@example.com", "dev@example.com"]);
        expect(team).toMatchObject({
            solutionTitle: "Mountain Link", leadName: "Sample Student", leadCertificate: null, maxMembers: 3,
            members: [{ id: "7", fullName: "Dev Negi", emailHint: "de•••@example.com", certificate: { hash: row.hash } }],
        });
        expect(JSON.stringify(team)).not.toContain("dev@example.com");
    });

    it("refuses team access to teammates and to a wrong lead phone", async () => {
        const list = jest.spyOn(teamMemberRepository, "listBySubmissionIds");
        await expect(
            certificateParticipantResolvers.Query.certificateTeamByLead(null, { input: { leadEmail: "dev@example.com", leadPhone: "9123456789" } }),
        ).rejects.toMatchObject({ extensions: { code: "NOT_TEAM_LEAD" } });
        await expect(
            certificateParticipantResolvers.Query.certificateTeamByLead(null, { input: { ...leadInput, leadPhone: "9000000000" } }),
        ).rejects.toMatchObject({ extensions: { code: "REGISTRATION_DETAILS_MISMATCH" } });
        expect(list).not.toHaveBeenCalled();
    });

    it("adds a teammate for a verified lead and hides their contact details", async () => {
        const add = jest.spyOn(teamMemberRepository, "addWithCertificate")
            .mockResolvedValue(ok({ member: teammate, certificate: row }));

        const result = await certificateParticipantResolvers.Mutation.addCertificateTeamMember(null, { input: teammateInput });

        expect(add).toHaveBeenCalledWith(expect.objectContaining({
            submissionId: "registered-submission",
            member: { fullName: "Dev Negi", email: "dev@example.com", phone: "9123456789" },
            certificate: expect.objectContaining({ hash: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/) }),
        }));
        expect(result).toEqual({ id: "7", fullName: "Dev Negi", emailHint: "de•••@example.com", certificate: expect.objectContaining({ hash: row.hash }) });
    });

    it("maps team rule violations to stable errors", async () => {
        const add = jest.spyOn(teamMemberRepository, "addWithCertificate");

        add.mockResolvedValueOnce(err(ERRORS.TEAM_FULL));
        await expect(certificateParticipantResolvers.Mutation.addCertificateTeamMember(null, { input: teammateInput }))
            .rejects.toMatchObject({ message: expect.stringContaining("team is full"), extensions: { code: "CONFLICT" } });

        add.mockResolvedValueOnce(err(ERRORS.PARTICIPANT_ALREADY_REGISTERED));
        await expect(certificateParticipantResolvers.Mutation.addCertificateTeamMember(null, { input: teammateInput }))
            .rejects.toMatchObject({ message: expect.stringContaining("already participated") });

        await expect(certificateParticipantResolvers.Mutation.addCertificateTeamMember(null, {
            input: { ...teammateInput, email: "student@example.com" },
        })).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });

        jest.setSystemTime(new Date("2026-09-23T16:00:00+05:30"));
        await expect(certificateParticipantResolvers.Mutation.addCertificateTeamMember(null, { input: teammateInput }))
            .rejects.toMatchObject({ extensions: { code: "REGISTRATION_CLOSED" } });
        expect(add).toHaveBeenCalledTimes(2);
    });

    it("masks emails for display", () => {
        expect(maskEmail("asha.rawat@gmail.com")).toBe("as•••@gmail.com");
    });
});
