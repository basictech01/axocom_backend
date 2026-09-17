-- UKIS team members. Solution submissions originally stored only the team lead,
-- so teammates had no registration and could not receive certificates. Each row
-- is one teammate on one submission; the lead stays in solution_submissions.
--
-- One person, one entry: normalized email and phone are unique here, and the
-- application also rejects a teammate whose email or phone belongs to any lead
-- (and a lead whose email or phone belongs to any teammate).
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
    INDEX idx_team_member_submission (submission_id),
    CONSTRAINT fk_team_member_submission FOREIGN KEY (submission_id)
        REFERENCES solution_submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
