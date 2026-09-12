import type { RowDataPacket } from "mysql2";

export const CERTIFICATE_PARTICIPANT_TABLE = "hackathon_certificate_participants";

export const CREATE_CERTIFICATE_PARTICIPANT_TABLE = `
CREATE TABLE IF NOT EXISTS hackathon_certificate_participants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    hash VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email_normalized VARCHAR(254) NOT NULL UNIQUE,
    phone_normalized VARCHAR(20) NOT NULL UNIQUE,
    institution VARCHAR(180) NOT NULL,
    course VARCHAR(160) NULL,
    city VARCHAR(120) NOT NULL,
    issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

export interface CertificateParticipantRow extends RowDataPacket {
    id: number;
    hash: string;
    full_name: string;
    email_normalized: string;
    phone_normalized: string;
    institution: string;
    course: string | null;
    city: string;
    issued_at: Date;
    created_at: Date;
}

export interface CreateCertificateParticipantRecord {
    hash: string;
    fullName: string;
    email: string;
    phone: string;
    institution: string;
    course: string | null;
    city: string;
}
