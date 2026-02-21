import { RowDataPacket } from "mysql2";

export const CREATE_CANDIDATE_TABLE = `
CREATE TABLE candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
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
    education_history JSON,
    education_category VARCHAR(255),
    university_name VARCHAR(255),
    source_of_income JSON,
    contracts JSON,
    social_profiles JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export const CANDIDATE_TABLE = 'candidates';

export interface Candidate extends RowDataPacket {
    id: number;
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
    education_history: JSON;
    education_category: string;
    university_name: string;
    source_of_income: JSON;
    contracts: JSON;
    social_profiles: JSON;
    created_at: Date;
}
