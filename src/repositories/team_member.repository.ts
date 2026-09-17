import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { err, ok, type Result } from "neverthrow";
import { db } from "../dataconfig/db";
import {
    CERTIFICATE_PARTICIPANT_TABLE,
    type CertificateParticipantRow,
} from "../models/certificate_participant.model";
import { SOLUTION_SUBMISSIONS_TABLE } from "../models/solution.model";
import {
    MAX_TEAM_MEMBERS,
    TEAM_MEMBERS_TABLE,
    type TeamMemberInput,
    type TeamMemberRow,
    type TeamMemberSource,
} from "../models/team_member.model";
import { ERRORS, RequestError, isDuplicateKeyError } from "../utils/error";
import createLogger from "../utils/logger";

const logger = createLogger("@team-member.repository");

export interface AddTeamMemberCertificateInput {
    submissionId: string;
    member: TeamMemberInput;
    certificate: { hash: string; institution: string; course: string | null; city: string };
}

/**
 * True when any of the emails or phones already belongs to a team lead or a
 * teammate. Runs on the caller's connection so it sees the open transaction.
 */
export async function isAnyIdentityRegistered(
    connection: PoolConnection,
    emails: string[],
    phones: string[]
): Promise<boolean> {
    const emailSlots = emails.map(() => "?").join(",");
    const phoneSlots = phones.map(() => "?").join(",");
    const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT 1 FROM ${SOLUTION_SUBMISSIONS_TABLE}
            WHERE normalized_email IN (${emailSlots}) OR normalized_phone IN (${phoneSlots})
         UNION ALL
         SELECT 1 FROM ${TEAM_MEMBERS_TABLE}
            WHERE normalized_email IN (${emailSlots}) OR normalized_phone IN (${phoneSlots})
         LIMIT 1`,
        [...emails, ...phones, ...emails, ...phones]
    );
    return rows.length > 0;
}

export async function insertTeamMembers(
    connection: PoolConnection,
    submissionId: string,
    members: TeamMemberInput[],
    addedBy: TeamMemberSource
): Promise<void> {
    for (const member of members) {
        await connection.execute(
            `INSERT INTO ${TEAM_MEMBERS_TABLE}
                (submission_id, full_name, email, normalized_email, phone, normalized_phone, added_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [submissionId, member.fullName, member.email, member.email, member.phone, member.phone, addedBy]
        );
    }
}

class TeamMemberRepository {
    async listBySubmissionIds(submissionIds: readonly string[]): Promise<Result<TeamMemberRow[], RequestError>> {
        if (submissionIds.length === 0) return ok([]);
        try {
            const [rows] = await db.execute<TeamMemberRow[]>(
                `SELECT * FROM ${TEAM_MEMBERS_TABLE}
                 WHERE submission_id IN (${submissionIds.map(() => "?").join(",")})
                 ORDER BY id`,
                [...submissionIds]
            );
            return ok(rows);
        } catch (error) {
            logger.error("Error listing team members:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async findByEmail(email: string): Promise<Result<TeamMemberRow | null, RequestError>> {
        try {
            const [rows] = await db.execute<TeamMemberRow[]>(
                `SELECT * FROM ${TEAM_MEMBERS_TABLE} WHERE normalized_email = ? LIMIT 1`,
                [email]
            );
            return ok(rows[0] ?? null);
        } catch (error) {
            logger.error("Error finding team member by email:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Issue a teammate's certificate on behalf of their verified team lead. The
     * teammate is either already on the team (registered with the solution) or
     * is added now. Locking the submission row serialises concurrent adds for one
     * team, so the four-person limit cannot be exceeded.
     */
    async addWithCertificate(
        input: AddTeamMemberCertificateInput
    ): Promise<Result<{ member: TeamMemberRow; certificate: CertificateParticipantRow }, RequestError>> {
        const { submissionId, member, certificate } = input;
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute(
                `SELECT id FROM ${SOLUTION_SUBMISSIONS_TABLE} WHERE id = ? FOR UPDATE`,
                [submissionId]
            );

            const [matches] = await connection.execute<TeamMemberRow[]>(
                `SELECT * FROM ${TEAM_MEMBERS_TABLE}
                 WHERE normalized_email = ? OR normalized_phone = ? FOR UPDATE`,
                [member.email, member.phone]
            );

            let memberRow = matches.find(
                (row) => row.normalized_email === member.email && row.normalized_phone === member.phone
            );
            if (memberRow && memberRow.submission_id !== submissionId) {
                await connection.rollback();
                return err(ERRORS.PARTICIPANT_ALREADY_REGISTERED);
            }
            if (!memberRow && matches.length > 0) {
                await connection.rollback();
                const onThisTeam = matches.every((row) => row.submission_id === submissionId);
                return err(onThisTeam ? ERRORS.TEAM_MEMBER_DETAILS_MISMATCH : ERRORS.PARTICIPANT_ALREADY_REGISTERED);
            }

            if (!memberRow) {
                if (await isAnyIdentityRegistered(connection, [member.email], [member.phone])) {
                    await connection.rollback();
                    return err(ERRORS.PARTICIPANT_ALREADY_REGISTERED);
                }
                const [countRows] = await connection.execute<Array<{ total: number } & RowDataPacket>>(
                    `SELECT COUNT(*) AS total FROM ${TEAM_MEMBERS_TABLE} WHERE submission_id = ?`,
                    [submissionId]
                );
                if (Number(countRows[0]?.total ?? 0) >= MAX_TEAM_MEMBERS) {
                    await connection.rollback();
                    return err(ERRORS.TEAM_FULL);
                }
                await insertTeamMembers(connection, submissionId, [member], "team_lead");
                const [inserted] = await connection.execute<TeamMemberRow[]>(
                    `SELECT * FROM ${TEAM_MEMBERS_TABLE} WHERE normalized_email = ? LIMIT 1`,
                    [member.email]
                );
                memberRow = inserted[0];
            }

            const [created] = await connection.execute<ResultSetHeader>(
                `INSERT INTO ${CERTIFICATE_PARTICIPANT_TABLE}
                    (hash, full_name, email_normalized, phone_normalized, institution, course, city)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    certificate.hash,
                    memberRow.full_name,
                    member.email,
                    member.phone,
                    certificate.institution,
                    certificate.course,
                    certificate.city,
                ]
            );
            const [certificates] = await connection.execute<CertificateParticipantRow[]>(
                `SELECT * FROM ${CERTIFICATE_PARTICIPANT_TABLE} WHERE id = ? LIMIT 1`,
                [created.insertId]
            );

            await connection.commit();
            return ok({ member: memberRow, certificate: certificates[0] });
        } catch (error) {
            await connection.rollback().catch(() => undefined);
            if (isDuplicateKeyError(error)) return err(ERRORS.DUPLICATE_RESOURCE);
            logger.error("Error adding team member certificate:", error);
            return err(ERRORS.DATABASE_ERROR);
        } finally {
            connection.release();
        }
    }
}

export const teamMemberRepository = new TeamMemberRepository();
