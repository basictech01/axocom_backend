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
    beforeEach(() => jest.restoreAllMocks());
    afterAll(() => server.stop());

    it("returns an explicit unregistered result after checking both stores", async () => {
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        const findRegistration = jest.spyOn(solutionRepository, "findByEmail").mockResolvedValue(ok(null));

        const response = await server.executeOperation({
            query: `query CertificateLookupByEmail($email: String!) {
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

    it("recognizes a hackathon registration even before certificate generation", async () => {
        jest.spyOn(certificateParticipantRepository, "findByEmail").mockResolvedValue(ok(null));
        jest.spyOn(solutionRepository, "findByEmail").mockResolvedValue(ok(registration as never));

        const response = await server.executeOperation({
            query: `query CertificateLookupByEmail($email: String!) {
                certificateLookupByEmail(email: $email) { registered certificate { hash } }
            }`,
            variables: { email: "REGISTERED@example.com" },
        });

        expect(response.body.kind).toBe("single");
        if (response.body.kind !== "single") return;
        expect(response.body.singleResult.data).toEqual({
            certificateLookupByEmail: { registered: true, certificate: null },
        });
    });
});
