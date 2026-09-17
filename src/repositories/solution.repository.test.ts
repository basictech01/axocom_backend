import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { solutionRepository } from "./solution.repository";
import { ERRORS } from "../utils/error";

const mockExecute = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetConnection = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock("../dataconfig/db", () => ({
    db: {
        execute: (...args: any[]) => mockExecute(...args),
        getConnection: (...args: any[]) => mockGetConnection(...args),
    },
}));

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
        mockGetConnection.mockReset();
    });

    it("creates a pending submission with normalized identity fields", async () => {
        mockExecute.mockResolvedValue([{ affectedRows: 1 }, []]);

        const result = await solutionRepository.create(validInput);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.status).toBe("received");
            expect(result.value.submissionId).toMatch(/^sub_[A-Za-z0-9_-]{12}$/);
        }
        expect(mockExecute).toHaveBeenCalledTimes(1);
        expect(mockExecute.mock.calls[0][0]).toContain("INSERT INTO solution_submissions");
        expect(mockExecute.mock.calls[0][1]).toEqual(expect.arrayContaining([
            "ASHA@Example.COM",
            "asha@example.com",
            "+91 98765-43210",
            "9876543210",
            "P-001",
        ]));
    });

    it("accepts a normalized problem code defined by a future frontend", async () => {
        mockExecute.mockResolvedValue([{ affectedRows: 1 }, []]);

        const result = await solutionRepository.create({
            ...validInput,
            problemCode: "  UKIS-2027-HEALTH-01  ",
        });

        expect(result.isOk()).toBe(true);
        expect(mockExecute.mock.calls[0][1]).toEqual(expect.arrayContaining([
            "UKIS-2027-HEALTH-01",
        ]));
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

    it("rejects malformed emails and whitespace-only required fields", async () => {
        const invalidEmail = await solutionRepository.create({ ...validInput, email: "not-an-email" });
        const blankTitle = await solutionRepository.create({ ...validInput, solutionTitle: "   " });

        expect(invalidEmail.isErr()).toBe(true);
        expect(blankTitle.isErr()).toBe(true);
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it("keeps connection failures inside the repository Result contract", async () => {
        mockGetConnection.mockRejectedValue(new Error("pool unavailable"));

        const result = await solutionRepository.addTeamMember(
            "asha@example.com",
            "9876543210",
            { fullName: "Dev Bisht", email: "dev@example.com", phone: "9123456789" },
        );

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.DATABASE_ERROR);
    });

    it("allows at most three additional members beside the leader", async () => {
        const connectionExecute = jest.fn<(...args: any[]) => Promise<any>>()
            .mockResolvedValueOnce([[{ id: "sub_1" }], []])
            .mockResolvedValueOnce([[{ total: 3 }], []]);
        const connection = {
            beginTransaction: jest.fn(async () => undefined),
            execute: connectionExecute,
            rollback: jest.fn(async () => undefined),
            commit: jest.fn(async () => undefined),
            release: jest.fn(),
        };
        mockGetConnection.mockResolvedValue(connection);

        const result = await solutionRepository.addTeamMember(
            "asha@example.com",
            "9876543210",
            { fullName: "Fourth Extra", email: "fourth@example.com", phone: "9123456789" },
        );

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.TEAM_LIMIT_REACHED);
        expect(connection.rollback).toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalled();
    });

    it("maps duplicate database keys to the domain duplicate error", async () => {
        mockExecute.mockRejectedValue({ code: "ER_DUP_ENTRY" });

        const result = await solutionRepository.create(validInput);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.DUPLICATE_SUBMISSION);
    });

    it("finds a leader only when their solution is accepted", async () => {
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
        const [query, parameters] = mockExecute.mock.calls[0];
        expect(query).toMatch(/FROM solution_submissions[\s\S]*status = 'accepted'/);
        expect(parameters).toEqual(["asha@example.com"]);
        expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("finds an accepted team member through the submissions join", async () => {
        const row = {
            full_name: "Dev Bisht",
            normalized_email: "dev@example.com",
            normalized_phone: "9123456789",
        };
        mockExecute
            .mockResolvedValueOnce([[], []])
            .mockResolvedValueOnce([[row], []]);

        const result = await solutionRepository.findByEmail(" DEV@Example.COM ");

        expect(result.isOk()).toBe(true);
        if (result.isOk()) expect(result.value).toEqual(row);
        const [query, parameters] = mockExecute.mock.calls[1];
        expect(query).toMatch(/FROM solution_team_members AS member[\s\S]*INNER JOIN solution_submissions AS submission/);
        expect(query).toContain("submission.id = member.solution_id");
        expect(query).not.toContain("COLLATE");
        expect(query).toMatch(/submission\.status = 'accepted'/);
        expect(parameters).toEqual(["dev@example.com"]);
    });

    it.each([
        [" ASHA@Example.COM ", "normalized_email", "asha@example.com"],
        ["+91 98765-43210", "normalized_phone", "9876543210"],
    ])("finds status by normalized contact %s", async (contact, column, normalized) => {
        const row = { id: "sub_1", status: "pending" };
        mockExecute.mockResolvedValue([[row], []]);

        const result = await solutionRepository.findStatusByContact(contact);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) expect(result.value).toEqual(row);
        expect(mockExecute).toHaveBeenCalledWith(
            expect.stringContaining(`WHERE ${column} = ?`),
            [normalized]
        );
        expect(mockExecute.mock.calls[0][0]).not.toContain("full_name");
    });

    it("rejects an invalid status contact without querying the database", async () => {
        const result = await solutionRepository.findStatusByContact("12345");

        expect(result.isErr()).toBe(true);
        if (result.isErr()) expect(result.error).toBe(ERRORS.INVALID_REQUEST_BODY);
        expect(mockExecute).not.toHaveBeenCalled();
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
