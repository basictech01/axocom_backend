import type { RowDataPacket } from "mysql2";

export const TEAM_MEMBERS_TABLE = "hackathon_solution_team_members";

/** A team can have up to four people: the lead in solution_submissions plus three members here. */
export const MAX_TEAM_MEMBERS = 3;

export const CREATE_TEAM_MEMBERS_TABLE = `
CREATE TABLE IF NOT EXISTS hackathon_solution_team_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    normalized_email VARCHAR(254) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    normalized_phone VARCHAR(20) NOT NULL,
    added_by ENUM('registration', 'team_lead') NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY unique_team_member_email (normalized_email),
    UNIQUE KEY unique_team_member_phone (normalized_phone),
    INDEX idx_team_member_submission (submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

export type TeamMemberSource = "registration" | "team_lead";

export interface TeamMemberRow extends RowDataPacket {
    id: number;
    submission_id: string;
    full_name: string;
    email: string;
    normalized_email: string;
    phone: string;
    normalized_phone: string;
    added_by: TeamMemberSource;
    created_at: Date;
}

export interface TeamMemberInput {
    fullName: string;
    email: string;
    phone: string;
}
