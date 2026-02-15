import { RowDataPacket } from "mysql2";

export const CREATE_CANDIDATE_TABLE = `
CREATE TABLE candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    neta_id INT NOT NULL, -- Unique identifier for the candidate on the myneta info
    name VARCHAR(255) NOT NULL,
    caste VARCHAR(255),
    so_do_wo VARCHAR(255),
    age INT NOT NULL,
    candidate_image VARCHAR(255),
    assembly_constituency VARCHAR(255) NOT NULL,
    party VARCHAR(255) NOT NULL,
    name_enrolled_as_voter_in VARCHAR(255) NOT NULL,
    self_profession VARCHAR(255),
    spouse_profession VARCHAR(255),
    criminal_cases INT,
    assets BIGINT,
    liabilities BIGINT,
    education_category VARCHAR(255),
    university_name VARCHAR(255),
    pan_itr JSON,
    details_of_criminal_cases JSON,
    details_of_movable_assets JSON,
    details_of_immovable_assets JSON,
    details_of_liabilities JSON,
    source_of_income JSON,
    contracts JSON,
    social_profiles JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export const CANDIDATE_TABLE = 'candidates';

export interface Candidate extends RowDataPacket {
    id: number;
    neta_id: number; // Unique identifier for the candidate on the myneta info
    name: string;
    caste: string;
    so_do_wo: string;
    age: number;
    candidate_image: string;
    assembly_constituency: string;
    party: string;
    name_enrolled_as_voter_in: string;
    self_profession: string;
    spouse_profession: string;
    criminal_cases: number;
    assets: number;
    liabilities: number;
    education_category: string;
    university_name: string;
    pan_itr: JSON;
    details_of_criminal_cases: JSON;
    details_of_movable_assets: JSON;
    details_of_immovable_assets: JSON;
    details_of_liabilities: JSON;
    source_of_income: JSON;
    contracts: JSON;
    social_profiles: JSON;
    created_at: Date;
}

