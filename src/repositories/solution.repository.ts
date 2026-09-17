import { randomBytes } from "node:crypto";
import { err, ok, type Result } from "neverthrow";
import { db } from "../dataconfig/db";
import {
    SOLUTION_SUBMISSIONS_TABLE,
    SOLUTION_TEAM_MEMBERS_TABLE,
    type CertificateEligibleRegistration,
    type CreateSolutionInput,
    type Pagination,
    type PublicSolution,
    type ReviewStatus,
    type SolutionSubmissionRow,
    type SolutionTeamMemberRow,
    type TeamMemberInput,
    type UpdateTeamSolutionInput,
} from "../models/solution.model";
import { ERRORS, RequestError, isDuplicateKeyError } from "../utils/error";
import createLogger from "../utils/logger";
import { isValidNormalizedPhone, normalizeEmail, normalizePhone } from "../utils/normalize";

const logger = createLogger("@solution.repository");

export type Paginated<T> = { data: T[]; pagination: Pagination };

/** A team is the lead plus up to this many additional members. */
const MAX_ADDITIONAL_TEAM_MEMBERS = 3;

function clampPage(page: number, limit: number) {
    const pageNumber = Math.max(1, page || 1);
    const limitNumber = Math.min(100, Math.max(1, limit || 20));
    return { pageNumber, limitNumber, offset: (pageNumber - 1) * limitNumber };
}

class SolutionRepository {
    private normalizeTeamLeaderCredentials(email: string, phone: string) {
        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);
        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
        return validEmail && isValidNormalizedPhone(normalizedPhone)
            ? { normalizedEmail, normalizedPhone }
            : null;
    }

    async create(input: CreateSolutionInput): Promise<Result<{ submissionId: string; status: string }, RequestError>> {
        const normalizedEmail = normalizeEmail(input.email ?? "");
        if (
            !input.fullName?.trim()
            || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
            || !input.phone?.trim()
            || !input.problemCode?.trim()
            || !input.solutionTitle?.trim()
            || !input.solutionDescription?.trim()
            || input.contactConsent !== true
        ) {
            return err(ERRORS.INVALID_REQUEST_BODY);
        }

        const problemCode = input.problemCode.trim();
        if (!problemCode || problemCode.length > 100) return err(ERRORS.INVALID_REQUEST_BODY);

        if (input.prototypeUrl && !input.prototypeUrl.startsWith("https://")) {
            return err(new RequestError("Prototype URL must be a valid HTTPS URL", 10002, 400));
        }

        const normalizedPhone = normalizePhone(input.phone);
        if (!isValidNormalizedPhone(normalizedPhone)) {
            return err(new RequestError("A valid 10-digit mobile number is required", 10002, 400));
        }

        const submissionId = `sub_${randomBytes(9).toString("base64url")}`;

        try {
            await db.execute(
                `INSERT INTO ${SOLUTION_SUBMISSIONS_TABLE}
                (id, full_name, email, normalized_email, phone, normalized_phone, problem_code, solution_title, solution_description, prototype_url, contact_consent_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'pending')`,
                [
                    submissionId,
                    input.fullName.trim(),
                    input.email.trim(),
                    normalizedEmail,
                    input.phone.trim(),
                    normalizedPhone,
                    problemCode,
                    input.solutionTitle.trim(),
                    input.solutionDescription.trim(),
                    input.prototypeUrl?.trim() || null,
                ]
            );
            return ok({ submissionId, status: "received" });
        } catch (error) {
            if (isDuplicateKeyError(error)) return err(ERRORS.DUPLICATE_SUBMISSION);
            logger.error("Error creating solution submission:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /** Find the authoritative hackathon registration used for certificate eligibility. */
    async findByEmail(email: string): Promise<Result<CertificateEligibleRegistration | null, RequestError>> {
        try {
            const normalizedEmail = normalizeEmail(email);
            const [leaders] = await db.execute<CertificateEligibleRegistration[]>(
                `SELECT full_name, normalized_email, normalized_phone
                 FROM ${SOLUTION_SUBMISSIONS_TABLE}
                 WHERE normalized_email = ? AND status = 'accepted'
                 LIMIT 1`,
                [normalizedEmail]
            );
            if (leaders[0]) return ok(leaders[0]);

            const [members] = await db.execute<CertificateEligibleRegistration[]>(
                `SELECT member.full_name, member.normalized_email, member.normalized_phone
                 FROM ${SOLUTION_TEAM_MEMBERS_TABLE} AS member
                 INNER JOIN ${SOLUTION_SUBMISSIONS_TABLE} AS submission
                     ON submission.id = member.solution_id
                 WHERE member.normalized_email = ? AND submission.status = 'accepted'
                 LIMIT 1`,
                [normalizedEmail]
            );
            return ok(members[0] ?? null);
        } catch (error) {
            logger.error("Error finding solution registration by email:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async findStatusByContact(contact: string): Promise<Result<SolutionSubmissionRow | null, RequestError>> {
        const isEmail = contact.includes("@");
        const normalizedContact = isEmail ? normalizeEmail(contact) : normalizePhone(contact);
        const isValidEmail = typeof normalizedContact === "string"
            && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContact);

        if ((isEmail && !isValidEmail) || (!isEmail && !isValidNormalizedPhone(normalizedContact))) {
            return err(ERRORS.INVALID_REQUEST_BODY);
        }

        const identityColumn = isEmail ? "normalized_email" : "normalized_phone";
        try {
            const [rows] = await db.execute<SolutionSubmissionRow[]>(
                `SELECT id, problem_code, solution_title, status, reviewed_at, created_at, updated_at
                 FROM ${SOLUTION_SUBMISSIONS_TABLE}
                 WHERE ${identityColumn} = ?
                 LIMIT 1`,
                [normalizedContact]
            );
            return ok(rows[0] ?? null);
        } catch (error) {
            logger.error("Error finding solution status by contact:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async findTeamDashboard(email: string, phone: string): Promise<Result<{
        solution: SolutionSubmissionRow;
        members: SolutionTeamMemberRow[];
    }, RequestError>> {
        const credentials = this.normalizeTeamLeaderCredentials(email, phone);
        if (!credentials) return err(ERRORS.UNAUTHORIZED);

        try {
            const [solutions] = await db.execute<SolutionSubmissionRow[]>(
                `SELECT * FROM ${SOLUTION_SUBMISSIONS_TABLE}
                 WHERE normalized_email = ? AND normalized_phone = ? LIMIT 1`,
                [credentials.normalizedEmail, credentials.normalizedPhone]
            );
            if (!solutions[0]) return err(ERRORS.UNAUTHORIZED);

            const [members] = await db.execute<SolutionTeamMemberRow[]>(
                `SELECT * FROM ${SOLUTION_TEAM_MEMBERS_TABLE} WHERE solution_id = ? ORDER BY created_at ASC`,
                [solutions[0].id]
            );
            return ok({ solution: solutions[0], members });
        } catch (error) {
            logger.error("Error loading team leader dashboard:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async updateByTeamLeader(
        email: string,
        phone: string,
        input: UpdateTeamSolutionInput
    ): Promise<Result<true, RequestError>> {
        const credentials = this.normalizeTeamLeaderCredentials(email, phone);
        if (!credentials) return err(ERRORS.UNAUTHORIZED);
        if (!input.solutionTitle?.trim() || !input.solutionDescription?.trim()) {
            return err(ERRORS.INVALID_REQUEST_BODY);
        }
        if (input.prototypeUrl && !input.prototypeUrl.startsWith("https://")) {
            return err(new RequestError("Prototype URL must be a valid HTTPS URL", 10002, 400));
        }

        try {
            const [result] = await db.execute<import("mysql2").ResultSetHeader>(
                `UPDATE ${SOLUTION_SUBMISSIONS_TABLE}
                 SET solution_title = ?, solution_description = ?, prototype_url = ?
                 WHERE normalized_email = ? AND normalized_phone = ?`,
                [
                    input.solutionTitle.trim(),
                    input.solutionDescription.trim(),
                    input.prototypeUrl?.trim() || null,
                    credentials.normalizedEmail,
                    credentials.normalizedPhone,
                ]
            );
            if (result.affectedRows === 0) return err(ERRORS.UNAUTHORIZED);
            return ok(true);
        } catch (error) {
            logger.error("Error updating solution from team dashboard:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async addTeamMember(
        email: string,
        phone: string,
        input: TeamMemberInput
    ): Promise<Result<SolutionTeamMemberRow, RequestError>> {
        const credentials = this.normalizeTeamLeaderCredentials(email, phone);
        const memberEmail = normalizeEmail(input.email);
        const memberPhone = normalizePhone(input.phone);
        if (
            !credentials
            || !input.fullName?.trim()
            || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail)
            || !isValidNormalizedPhone(memberPhone)
        ) return err(credentials ? ERRORS.INVALID_REQUEST_BODY : ERRORS.UNAUTHORIZED);

        let connection: Awaited<ReturnType<typeof db.getConnection>> | null = null;
        try {
            connection = await db.getConnection();
            await connection.beginTransaction();
            const [solutions] = await connection.execute<SolutionSubmissionRow[]>(
                `SELECT * FROM ${SOLUTION_SUBMISSIONS_TABLE}
                 WHERE normalized_email = ? AND normalized_phone = ? LIMIT 1 FOR UPDATE`,
                [credentials.normalizedEmail, credentials.normalizedPhone]
            );
            const solution = solutions[0];
            if (!solution) {
                await connection.rollback();
                return err(ERRORS.UNAUTHORIZED);
            }

            const [counts] = await connection.execute<Array<{ total: number } & import("mysql2").RowDataPacket>>(
                `SELECT COUNT(*) AS total FROM ${SOLUTION_TEAM_MEMBERS_TABLE} WHERE solution_id = ?`,
                [solution.id]
            );
            if (Number(counts[0]?.total ?? 0) >= MAX_ADDITIONAL_TEAM_MEMBERS) {
                await connection.rollback();
                return err(ERRORS.TEAM_LIMIT_REACHED);
            }

            const [registered] = await connection.execute<Array<{ id: string } & import("mysql2").RowDataPacket>>(
                `SELECT id FROM ${SOLUTION_SUBMISSIONS_TABLE}
                 WHERE normalized_email = ? OR normalized_phone = ? LIMIT 1`,
                [memberEmail, memberPhone]
            );
            if (registered[0]) {
                await connection.rollback();
                return err(ERRORS.TEAM_MEMBER_EXISTS);
            }

            const [insert] = await connection.execute<import("mysql2").ResultSetHeader>(
                `INSERT INTO ${SOLUTION_TEAM_MEMBERS_TABLE}
                 (solution_id, full_name, email, normalized_email, phone, normalized_phone)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [solution.id, input.fullName.trim(), input.email.trim(), memberEmail, input.phone.trim(), memberPhone]
            );
            const [members] = await connection.execute<SolutionTeamMemberRow[]>(
                `SELECT * FROM ${SOLUTION_TEAM_MEMBERS_TABLE} WHERE id = ?`,
                [insert.insertId]
            );
            await connection.commit();
            return ok(members[0]);
        } catch (error) {
            if (connection) await connection.rollback();
            if (isDuplicateKeyError(error)) return err(ERRORS.TEAM_MEMBER_EXISTS);
            logger.error("Error adding solution team member:", error);
            return err(ERRORS.DATABASE_ERROR);
        } finally {
            connection?.release();
        }
    }

    async listPublic(options: {
        problemCode?: string | null;
        page?: number;
        limit?: number;
    }): Promise<Result<Paginated<PublicSolution>, RequestError>> {
        const { pageNumber, limitNumber, offset } = clampPage(options.page ?? 1, options.limit ?? 50);
        let where = "WHERE status = 'accepted'";
        const params: Array<string | number> = [];

        if (options.problemCode) {
            where += " AND problem_code = ?";
            params.push(options.problemCode);
        }

        try {
            const [rows] = await db.execute<SolutionSubmissionRow[]>(
                `SELECT id, full_name, problem_code, solution_title, solution_description, prototype_url, created_at, status
                 FROM ${SOLUTION_SUBMISSIONS_TABLE}
                 ${where}
                 ORDER BY created_at DESC
                 LIMIT ${limitNumber} OFFSET ${offset}`,
                params
            );
            const [countRows] = await db.execute<Array<{ total: number } & import("mysql2").RowDataPacket>>(
                `SELECT COUNT(*) AS total FROM ${SOLUTION_SUBMISSIONS_TABLE} ${where}`,
                params
            );
            const total = Number(countRows[0]?.total ?? 0);
            return ok({
                data: rows as PublicSolution[],
                pagination: {
                    total,
                    page: pageNumber,
                    limit: limitNumber,
                    totalPages: Math.ceil(total / limitNumber) || 1,
                },
            });
        } catch (error) {
            logger.error("Error listing public solutions:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async listAdmin(options: {
        status?: string | null;
        search?: string | null;
        problemCode?: string | null;
        page?: number;
        limit?: number;
    }): Promise<Result<Paginated<SolutionSubmissionRow>, RequestError>> {
        const { pageNumber, limitNumber, offset } = clampPage(options.page ?? 1, options.limit ?? 20);
        let where = "WHERE 1=1";
        const params: Array<string | number> = [];

        if (options.status) {
            where += " AND status = ?";
            params.push(options.status);
        }
        if (options.problemCode) {
            where += " AND problem_code = ?";
            params.push(options.problemCode);
        }
        if (options.search) {
            where += " AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR solution_title LIKE ?)";
            const search = `%${options.search}%`;
            params.push(search, search, search, search);
        }

        try {
            const [rows] = await db.execute<SolutionSubmissionRow[]>(
                `SELECT * FROM ${SOLUTION_SUBMISSIONS_TABLE} ${where} ORDER BY created_at DESC LIMIT ${limitNumber} OFFSET ${offset}`,
                params
            );
            const [countRows] = await db.execute<Array<{ total: number } & import("mysql2").RowDataPacket>>(
                `SELECT COUNT(*) AS total FROM ${SOLUTION_SUBMISSIONS_TABLE} ${where}`,
                params
            );
            const total = Number(countRows[0]?.total ?? 0);
            return ok({
                data: rows,
                pagination: {
                    total,
                    page: pageNumber,
                    limit: limitNumber,
                    totalPages: Math.ceil(total / limitNumber) || 1,
                },
            });
        } catch (error) {
            logger.error("Error listing solution submissions:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async getById(id: string): Promise<Result<SolutionSubmissionRow, RequestError>> {
        try {
            const [rows] = await db.execute<SolutionSubmissionRow[]>(
                `SELECT * FROM ${SOLUTION_SUBMISSIONS_TABLE} WHERE id = ?`,
                [id]
            );
            if (!rows[0]) return err(ERRORS.SOLUTION_NOT_FOUND);
            return ok(rows[0]);
        } catch (error) {
            logger.error("Error fetching solution submission:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async updateStatus(
        id: string,
        status: ReviewStatus,
        adminNote: string | null | undefined,
        adminId: number
    ): Promise<Result<true, RequestError>> {
        if (!["pending", "accepted", "rejected"].includes(status)) {
            return err(ERRORS.INVALID_REVIEW_STATUS);
        }

        try {
            const [result] = await db.execute<import("mysql2").ResultSetHeader>(
                `UPDATE ${SOLUTION_SUBMISSIONS_TABLE}
                 SET status = ?, admin_note = ?, reviewed_at = NOW(), reviewed_by_admin_id = ?
                 WHERE id = ?`,
                [status, adminNote ?? null, adminId, id]
            );
            if (result.affectedRows === 0) return err(ERRORS.SOLUTION_NOT_FOUND);
            return ok(true);
        } catch (error) {
            logger.error("Error updating solution status:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async countAccepted(): Promise<Result<number, RequestError>> {
        try {
            const [rows] = await db.execute<Array<{ total: number } & import("mysql2").RowDataPacket>>(
                `SELECT COUNT(*) AS total FROM ${SOLUTION_SUBMISSIONS_TABLE} WHERE status = 'accepted'`
            );
            return ok(Number(rows[0]?.total ?? 0));
        } catch (error) {
            logger.error("Error counting accepted solutions:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }
}

export const solutionRepository = new SolutionRepository();
