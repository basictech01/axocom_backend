import { ApolloServer } from "@apollo/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ok } from "neverthrow";
import { certificateParticipantRepository } from "../repositories/certificate_participant.repository";
import { solutionRepository } from "../repositories/solution.repository";
import { buildGraphQL } from "./loaders/graphql.loader";

const registration = {
    id: "abcdefghijklmnopqrstuvwx",
    full_name: "Registered Student",
    email: "registered@example.com",
    normalized_email: "registered@example.com",
    phone: "9876543210",
    normalized_phone: "9876543210",
    problem_code: "P-001",
    solution_title: "Registered solution",
    solution_description: "A sufficiently detailed registered solution.",
    prototype_url: null,
    contact_consent_at: new Date("2026-09-10T10:00:00.000Z"),
    status: "pending" as const,
    admin_note: null,
    reviewed_at: null,
    reviewed_by_admin_id: null,
    created_at: new Date("2026-09-10T10:00:00.000Z"),
    updated_at: new Date("2026-09-10T10:00:00.000Z"),
};

describe("certificate GraphQL flow", () => {
    const server = new ApolloServer(buildGraphQL());

    beforeAll(() => server.start());
    beforeEach(() => { jest.restoreAllMocks(); });
    afterAll(() => server.stop());

    it("returns an explicit unregistered result after checking both stores", async () => {
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        const findRegistration = jest.spyOn(solutionRepository, "findByEmail").mockResolvedValue(ok(null));

        const response = await server.executeOperation({
            query: `mutation CertificateLookupByEmail($email: String!) {
                certificateLookupByEmail(email: $email) { registered certificate { hash } }
            }`,
            variables: { email: "missing@example.com" },
        });

        expect(response.body.kind).toBe("single");
        if (response.body.kind !== "single") return;
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data).toEqual({
            certificateLookupByEmail: { registered: false, certificate: null },
        });
        expect(findRegistration).toHaveBeenCalledWith("missing@example.com");
    });

    it("generates a certificate for a registered email when one does not exist", async () => {
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        const create = jest.spyOn(certificateParticipantRepository, "create").mockImplementation(async (input) => ok({
            id: 1,
            hash: input.hash,
            full_name: input.fullName,
            email_normalized: input.email,
            phone_normalized: input.phone,
            institution: input.institution,
            course: input.course,
            city: input.city,
            issued_at: new Date("2026-09-17T10:00:00.000Z"),
            created_at: new Date("2026-09-17T10:00:00.000Z"),
        } as never));
        jest.spyOn(solutionRepository, "findByEmail").mockResolvedValue(ok(registration as never));

        const response = await server.executeOperation({
            query: `mutation CertificateLookupByEmail($email: String!) {
                certificateLookupByEmail(email: $email) { registered certificate { hash } }
            }`,
            variables: { email: "REGISTERED@example.com" },
        });

        expect(response.body.kind).toBe("single");
        if (response.body.kind !== "single") return;
        expect(response.body.singleResult.data).toEqual({
            certificateLookupByEmail: {
                registered: true,
                certificate: { hash: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/) },
            },
        });
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            institution: null,
            city: null,
        }));
    });

    it("generates a certificate using a registered team member's identity", async () => {
        const teamMember = {
            full_name: "Team Member",
            normalized_email: "member@example.com",
            normalized_phone: "9876543211",
        };
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        const create = jest.spyOn(certificateParticipantRepository, "create").mockImplementation(async (input) => ok({
            id: 2,
            hash: input.hash,
            full_name: input.fullName,
            email_normalized: input.email,
            phone_normalized: input.phone,
            institution: input.institution,
            course: input.course,
            city: input.city,
            issued_at: new Date("2026-09-17T10:00:00.000Z"),
            created_at: new Date("2026-09-17T10:00:00.000Z"),
        } as never));
        jest.spyOn(solutionRepository, "findByEmail").mockResolvedValue(ok(teamMember as never));

        const response = await server.executeOperation({
            query: `mutation CertificateLookupByEmail($email: String!) {
                certificateLookupByEmail(email: $email) { registered certificate { fullName hash } }
            }`,
            variables: { email: "MEMBER@example.com" },
        });

        expect(response.body.kind).toBe("single");
        if (response.body.kind !== "single") return;
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data).toEqual({
            certificateLookupByEmail: {
                registered: true,
                certificate: {
                    fullName: "Team Member",
                    hash: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
                },
            },
        });
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            fullName: "Team Member",
            email: "member@example.com",
            phone: "9876543211",
        }));
    });
});
