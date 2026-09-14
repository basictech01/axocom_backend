-- Additive UKIS certificate storage. Existing application and hackathon
-- registration tables are not altered.
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
