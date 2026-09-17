import type { ResultSetHeader } from "mysql2";
import { err, ok, type Result } from "neverthrow";
import { db } from "../dataconfig/db";
import {
    CERTIFICATE_PARTICIPANT_TABLE,
    type CertificateParticipantRow,
    type CreateCertificateParticipantRecord,
} from "../models/certificate_participant.model";
import { ERRORS, type RequestError } from "../utils/error";
import createLogger from "../utils/logger";

const logger = createLogger("@certificate-participant.repository");

class CertificateParticipantRepository {
    async create(input: CreateCertificateParticipantRecord): Promise<Result<CertificateParticipantRow, RequestError>> {
        try {
            const [result] = await db.execute<ResultSetHeader>(
                `INSERT INTO ${CERTIFICATE_PARTICIPANT_TABLE}
                    (hash, full_name, email_normalized, phone_normalized, institution, course, city)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [input.hash, input.fullName, input.email, input.phone, input.institution, input.course, input.city],
            );
            const [rows] = await db.execute<CertificateParticipantRow[]>(
                `SELECT * FROM ${CERTIFICATE_PARTICIPANT_TABLE} WHERE id = ? LIMIT 1`,
                [result.insertId],
            );
            return ok(rows[0]);
        } catch (error: unknown) {
            if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
                return err(ERRORS.DUPLICATE_RESOURCE);
            }
            logger.error("Error creating certificate participant", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async findByEmail(email: string): Promise<Result<CertificateParticipantRow | null, RequestError>> {
        return this.findOne("email_normalized", email);
    }

    async findByHash(hash: string): Promise<Result<CertificateParticipantRow | null, RequestError>> {
        return this.findOne("hash", hash);
    }

    async findByEmailOrPhone(email: string, phone: string): Promise<Result<CertificateParticipantRow | null, RequestError>> {
        try {
            const [rows] = await db.execute<CertificateParticipantRow[]>(
                `SELECT * FROM ${CERTIFICATE_PARTICIPANT_TABLE}
                 WHERE email_normalized = ? OR phone_normalized = ? LIMIT 1`,
                [email, phone],
            );
            return ok(rows[0] ?? null);
        } catch (error) {
            logger.error("Error finding certificate participant by email or phone", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    private async findOne(column: "email_normalized" | "hash", value: string): Promise<Result<CertificateParticipantRow | null, RequestError>> {
        try {
            const [rows] = await db.execute<CertificateParticipantRow[]>(
                `SELECT * FROM ${CERTIFICATE_PARTICIPANT_TABLE} WHERE ${column} = ? LIMIT 1`,
                [value],
            );
            return ok(rows[0] ?? null);
        } catch (error) {
            logger.error(`Error finding certificate participant by ${column}`, error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }
}

export const certificateParticipantRepository = new CertificateParticipantRepository();
