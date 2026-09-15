import mysql from "mysql2/promise";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CREATE_CERTIFICATE_PARTICIPANT_TABLE } from "../models/certificate_participant.model";
import { CREATE_SOLUTION_SUBMISSIONS_TABLE } from "../models/solution.model";
import { CREATE_TEAM_MEMBERS_TABLE } from "../models/team_member.model";
import { ERRORS } from "../utils/error";
import { solutionRepository } from "./solution.repository";
import { teamMemberRepository } from "./team_member.repository";

let mockPool: mysql.Pool;
let container: StartedTestContainer;

jest.setTimeout(180000);

jest.mock("../dataconfig/db", () => ({
    get db() {
        return mockPool;
    },
}));

const solo = {
    fullName: "Asha Rawat",
    email: "asha@example.com",
    phone: "9876543210",
    problemCode: "P-001",
    solutionTitle: "Mountain Link",
    solutionDescription: "A practical solution for remote communities.",
    contactConsent: true,
};

const person = (n: number) => ({ fullName: `Member ${n}`, email: `member${n}@example.com`, phone: `900000000${n}` });

const certificate = (n: number) => ({ hash: `hash-${n}-abcdefghijklmnopqrstuvwxyz`, institution: "Example University", course: null, city: "Dehradun" });

async function createEntry(overrides: Partial<typeof solo> & { teamMembers?: ReturnType<typeof person>[] } = {}) {
    const result = await solutionRepository.create({ ...solo, ...overrides });
    if (result.isErr()) throw result.error;
    return result.value.submissionId;
}

beforeAll(async () => {
    container = await new GenericContainer("mysql:8.0")
        .withExposedPorts(3306)
        .withEnvironment({ MYSQL_ROOT_PASSWORD: "root", MYSQL_DATABASE: "test_db" })
        .withWaitStrategy(Wait.forLogMessage(/ready for connections.*port: 3306/))
        .start();

    mockPool = mysql.createPool({
        host: container.getHost(),
        port: container.getMappedPort(3306),
        user: "root",
        password: "root",
        database: "test_db",
        connectionLimit: 10,
    });

    // The reviewer foreign key points at the users table, which this test does not need.
    await mockPool.query(CREATE_SOLUTION_SUBMISSIONS_TABLE.replace(/,\s*CONSTRAINT fk_solution_reviewer[^\n]*/, ""));
    await mockPool.query(CREATE_TEAM_MEMBERS_TABLE);
    await mockPool.query(CREATE_CERTIFICATE_PARTICIPANT_TABLE);
});

afterAll(async () => {
    await mockPool?.end();
    await container?.stop();
});

beforeEach(async () => {
    await mockPool.query("DELETE FROM hackathon_certificate_participants");
    await mockPool.query("DELETE FROM hackathon_solution_team_members");
    await mockPool.query("DELETE FROM solution_submissions");
});

describe("one person, one entry (MySQL)", () => {
    it("saves a team entry with its teammates", async () => {
        const submissionId = await createEntry({ teamMembers: [person(1), person(2)] });

        const members = await teamMemberRepository.listBySubmissionIds([submissionId]);
        expect(members._unsafeUnwrap().map((m) => m.normalized_email)).toEqual(["member1@example.com", "member2@example.com"]);
    });

    it("rejects a new entry whose lead is already a teammate elsewhere", async () => {
        await createEntry({ teamMembers: [person(1)] });

        const result = await solutionRepository.create({ ...solo, ...person(1), email: person(1).email });
        expect(result._unsafeUnwrapErr()).toBe(ERRORS.DUPLICATE_SUBMISSION);
    });

    it("rejects a new entry that lists an existing lead or teammate", async () => {
        await createEntry({ teamMembers: [person(1)] });

        const reusedLead = await solutionRepository.create({
            ...solo, email: "new@example.com", phone: "9111111111", teamMembers: [{ ...person(5), email: solo.email }],
        });
        const reusedMemberPhone = await solutionRepository.create({
            ...solo, email: "new@example.com", phone: "9111111111", teamMembers: [{ ...person(5), phone: person(1).phone }],
        });

        expect(reusedLead._unsafeUnwrapErr()).toBe(ERRORS.DUPLICATE_SUBMISSION);
        expect(reusedMemberPhone._unsafeUnwrapErr()).toBe(ERRORS.DUPLICATE_SUBMISSION);
        const [rows] = await mockPool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS total FROM solution_submissions");
        expect(rows[0].total).toBe(1);
    });
});

describe("teammate certificates (MySQL)", () => {
    it("adds a teammate to an old solo-recorded entry and issues their certificate", async () => {
        const submissionId = await createEntry();

        const result = await teamMemberRepository.addWithCertificate({ submissionId, member: person(1), certificate: certificate(1) });

        const { member, certificate: issued } = result._unsafeUnwrap();
        expect(member).toMatchObject({ submission_id: submissionId, full_name: "Member 1", added_by: "team_lead" });
        expect(issued).toMatchObject({ full_name: "Member 1", email_normalized: "member1@example.com" });
    });

    it("issues a certificate for a teammate registered with the entry, using the registered name", async () => {
        const submissionId = await createEntry({ teamMembers: [person(1)] });

        const result = await teamMemberRepository.addWithCertificate({
            submissionId, member: { ...person(1), fullName: "Different Name" }, certificate: certificate(1),
        });

        expect(result._unsafeUnwrap().certificate.full_name).toBe("Member 1");
        expect((await teamMemberRepository.listBySubmissionIds([submissionId]))._unsafeUnwrap()).toHaveLength(1);
    });

    it("rejects wrong details for a registered teammate", async () => {
        const submissionId = await createEntry({ teamMembers: [person(1)] });

        const result = await teamMemberRepository.addWithCertificate({
            submissionId, member: { ...person(1), phone: "9222222222" }, certificate: certificate(1),
        });

        expect(result._unsafeUnwrapErr()).toBe(ERRORS.TEAM_MEMBER_DETAILS_MISMATCH);
    });

    it("rejects people who already participated in another entry", async () => {
        const otherTeam = await createEntry({ teamMembers: [person(1)] });
        const submissionId = await createEntry({ email: "lead2@example.com", phone: "9333333333" });

        const otherTeammate = await teamMemberRepository.addWithCertificate({ submissionId, member: person(1), certificate: certificate(1) });
        const otherLead = await teamMemberRepository.addWithCertificate({
            submissionId, member: { fullName: "Asha", email: solo.email, phone: solo.phone }, certificate: certificate(2),
        });

        expect(otherTeammate._unsafeUnwrapErr()).toBe(ERRORS.PARTICIPANT_ALREADY_REGISTERED);
        expect(otherLead._unsafeUnwrapErr()).toBe(ERRORS.PARTICIPANT_ALREADY_REGISTERED);
        expect((await teamMemberRepository.listBySubmissionIds([otherTeam, submissionId]))._unsafeUnwrap()).toHaveLength(1);
    });

    it("refuses a second certificate for the same teammate", async () => {
        const submissionId = await createEntry();
        await teamMemberRepository.addWithCertificate({ submissionId, member: person(1), certificate: certificate(1) });

        const again = await teamMemberRepository.addWithCertificate({ submissionId, member: person(1), certificate: certificate(2) });

        expect(again._unsafeUnwrapErr()).toBe(ERRORS.DUPLICATE_RESOURCE);
    });

    it("never lets concurrent adds grow a team past four people", async () => {
        const submissionId = await createEntry();

        const results = await Promise.all(
            [1, 2, 3, 4, 5, 6].map((n) =>
                teamMemberRepository.addWithCertificate({ submissionId, member: person(n), certificate: certificate(n) }),
            ),
        );

        expect(results.filter((r) => r.isOk())).toHaveLength(3);
        expect(results.filter((r) => r.isErr()).map((r) => r._unsafeUnwrapErr())).toEqual([ERRORS.TEAM_FULL, ERRORS.TEAM_FULL, ERRORS.TEAM_FULL]);
        const [rows] = await mockPool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS total FROM hackathon_certificate_participants");
        expect(rows[0].total).toBe(3);
    });
});
