CREATE TABLE IF NOT EXISTS solution_team_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    solution_id VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    normalized_email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    normalized_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_team_member_email (normalized_email),
    UNIQUE KEY unique_team_member_phone (normalized_phone),
    INDEX idx_team_member_solution (solution_id),
    CONSTRAINT fk_team_member_solution FOREIGN KEY (solution_id)
        REFERENCES solution_submissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;