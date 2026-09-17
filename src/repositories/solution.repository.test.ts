import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { solutionRepository } from "./solution.repository";
import { ERRORS } from "../utils/error";

const mockExecute = jest.fn<(...args: any[]) => Promise<any>>();
const mockConnection = {
    execute: (...args: any[]) => mockExecute(...args),
    beginTransaction: jest.fn(async () => undefined),
    commit: jest.fn(async () => undefined),
    rollback: jest.fn(async () => undefined),
    release: jest.fn(),
};

jest.mock("../dataconfig/db", () => ({
    db: {
        execute: (...args: any[]) => mockExecute(...args),
        getConnection: async () => mockConnection,
    },
}));

/** Route the identity check to "nobody registered" and every write to success. */
function databaseWithNoExistingParticipants() {
    mockExecute.mockImplementation(async (sql: string) =>
        sql.startsWith("SELECT 1") ? [[], []] : [{ affectedRows: 1 }, []]
    );
}

const insertCalls = (table: string) =>
    mockExecute.mock.calls.filter(([sql]) => String(sql).includes(`INSERT INTO ${table}`));

const validInput = {
    fullName: "Asha Rawat",
    email: " ASHA@Example.COM ",
    phone: "+91 98765-43210",
    problemCode: "P-001",
    solutionTitle: "Mountain Link",
    solutionDescription: "A practical solution for remote communities.",
    prototypeUrl: "https://example.com/prototype",
    contactConsent: true,
};

describe("SolutionRepository", () => {
    beforeEach(() => {
        mockExecute.mockReset();
        jest.clearAllMocks();
    });

    it("creates a pending submission with normalized identity fields", async () => {
        databaseWithNoExistingParticipants();

        const result = await solutionRepository.create(validInput);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.status).toBe("received");
            expect(result.value.submissionId).toMatch(/^sub_[A-Za-z0-9_-]{12}$/);
        }
        expect(insertCalls("solution_submissions")).toHaveLength(1);
        expect(insertCalls("hackathon_solution_team_members")).toHaveLength(0);
        expect(mockConnection.commit).toHaveBeenCalled();
        expect(insertCalls("solution_submissions")[0][1]).toEqual(expect.arrayContaining([
            "ASHA@Example.COM",
            "asha@example.com",
            "+91 98765-43210",
            "9876543210",
            "P-001",
        ]));
    });

    it("accepts a normalized problem code defined by a future frontend", async () => {
        databaseWithNoExistingParticipants();

        const result = await solutionRepository.create({
            ...validInput,
            problemCode: "  UKIS-2027-HEALTH-01  ",
        });

        expect(result.isOk()).toBe(true);
        expect(insertCalls("solution_submissions")[0][1]).toEqual(expect.arrayContaining([
            "UKIS-2027-HEALTH-01",
        ]));
    });

    it("stores normalized teammates in the same transaction as the lead", async () => {
        databaseWithNoExistingParticipants();

        const result = await solutionRepository.create({
            ...validInput,
            teamMembers: [
                { fullName: "  Dev   Negi ", email: " Dev@Example.com", phone: "+91 91234 56789" },
                { fullName: "Mira Bisht", email: "mira@example.com", phone: "9000000001" },
            ],
        });

        expect(result.isOk()).toBe(true);
        const members = insertCalls("hackathon_solution_team_members");
        expect(members).toHaveLength(2);
        expect(members[0][1]).toEqual(expect.arrayContaining([
            "Dev Negi", "dev@example.com", "9123456789", "registration",
        ]));
        const identityCheck = mockExecute.mock.calls.find(([sql]) => String(sql).startsWith("SELECT 1"));
        expect(identityCheck?.[1]).toEqual(expect.arrayContaining([
            "asha@example.com", "dev@example.com", "mira@example.com", "9876543210", "9123456789",
        ]));
    });

    it("rejects an entry when any person already participated as a lead or teammate", async () => {
        mockExecute.mockImplementation(async (sql: string) =>
            sql.startsWith("SELECT 1") ? [[{ 1: 1 }], []] : [{ affectedRows: 1 }, []]
        );

        const result = await solutionRepository.create({
            ...validInput,
            teamMembers: [{ fullName: "Dev Negi", email: "dev@example.com", phone: "9123456789" }],
        });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.DUPLICATE_SUBMISSION);
        expect(insertCalls("solution_submissions")).toHaveLength(0);
        expect(mockConnection.rollback).toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalled();
    });

    it.each([
        ["more than three teammates", Array.from({ length: 4 }, (_, i) => ({
            fullName: `Member ${i}`, email: `m${i}@example.com`, phone: `900000000${i}`,
        }))],
        ["a teammate reusing the lead's email", [{ fullName: "Dev Negi", email: "asha@example.com", phone: "9123456789" }]],
        ["a teammate reusing the lead's phone", [{ fullName: "Dev Negi", email: "dev@example.com", phone: "98765 43210" }]],
        ["two teammates sharing an email", [
            { fullName: "Dev Negi", email: "dev@example.com", phone: "9123456789" },
            { fullName: "Mira Bisht", email: "DEV@example.com", phone: "9000000001" },
        ]],
        ["a teammate without a valid phone", [{ fullName: "Dev Negi", email: "dev@example.com", phone: "123" }]],
    ])("rejects %s without querying the database", async (_, teamMembers) => {
        const result = await solutionRepository.create({ ...validInput, teamMembers });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.INVALID_TEAM);
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it("rejects problem codes that exceed the database column limit", async () => {
        const result = await solutionRepository.create({ ...validInput, problemCode: "P".repeat(101) });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.INVALID_REQUEST_BODY);
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it("rejects invalid phone numbers and insecure prototype URLs", async () => {
        const invalidPhone = await solutionRepository.create({ ...validInput, phone: "12345" });
        const invalidUrl = await solutionRepository.create({ ...validInput, prototypeUrl: "http://example.com" });

        expect(invalidPhone.isErr()).toBe(true);
        expect(invalidUrl.isErr()).toBe(true);
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it("maps duplicate database keys to the domain duplicate error", async () => {
        mockExecute.mockRejectedValue({ code: "ER_DUP_ENTRY" });

        const result = await solutionRepository.create(validInput);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.DUPLICATE_SUBMISSION);
    });

    it("finds a certificate-eligible registration by normalized email", async () => {
        const row = {
            id: "sub_1",
            full_name: "Asha Rawat",
            normalized_email: "asha@example.com",
            normalized_phone: "9876543210",
        };
        mockExecute.mockResolvedValue([[row], []]);

        const result = await solutionRepository.findByEmail(" ASHA@Example.COM ");

        expect(result.isOk()).toBe(true);
        if (result.isOk()) expect(result.value).toEqual(row);
        expect(mockExecute).toHaveBeenCalledWith(
            expect.stringContaining("WHERE normalized_email = ?"),
            ["asha@example.com"]
        );
    });

    it("lists accepted solutions with filters and pagination metadata", async () => {
        const row = {
            id: "sub_1",
            full_name: "Asha Rawat",
            problem_code: "P-001",
            solution_title: "Mountain Link",
            solution_description: "Description",
            prototype_url: null,
            created_at: new Date("2026-01-01"),
            status: "accepted",
        };
        mockExecute
            .mockResolvedValueOnce([[row], []])
            .mockResolvedValueOnce([[{ total: 21 }], []]);

        const result = await solutionRepository.listPublic({ problemCode: "P-001", page: 2, limit: 10 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.data).toEqual([row]);
            expect(result.value.pagination).toEqual({ total: 21, page: 2, limit: 10, totalPages: 3 });
        }
        expect(mockExecute.mock.calls[0][0]).toContain("LIMIT 10 OFFSET 10");
        expect(mockExecute.mock.calls[0][1]).toEqual(["P-001"]);
    });

    it("returns not found when a submission does not exist", async () => {
        mockExecute.mockResolvedValue([[], []]);

        const result = await solutionRepository.getById("sub_missing");

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.SOLUTION_NOT_FOUND);
    });

    it("records the Axocom admin user when updating status", async () => {
        mockExecute.mockResolvedValue([{ affectedRows: 1 }, []]);

        const result = await solutionRepository.updateStatus("sub_1", "accepted", "Strong fit", 42);

        expect(result.isOk()).toBe(true);
        expect(mockExecute).toHaveBeenCalledWith(
            expect.stringContaining("reviewed_by_admin_id = ?"),
            ["accepted", "Strong fit", 42, "sub_1"]
        );
    });

    it("rejects unsupported review statuses without querying the database", async () => {
        const result = await solutionRepository.updateStatus("sub_1", "archived" as any, null, 42);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.INVALID_REVIEW_STATUS);
        expect(mockExecute).not.toHaveBeenCalled();
    });
});
