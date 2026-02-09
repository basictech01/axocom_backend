import { RowDataPacket } from "mysql2";

export const CREATE_VOTER_TABLE = `
CREATE TABLE voter_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    epic_number VARCHAR(50) NOT NULL UNIQUE,
    first_name_english VARCHAR(255) NOT NULL,
    first_name_local VARCHAR(255),
    last_name_english VARCHAR(255),
    last_name_local VARCHAR(255),
    gender VARCHAR(10) NOT NULL,
    age INT NOT NULL,
    relative_first_name_english VARCHAR(255),
    relative_first_name_local VARCHAR(255) ,
    relative_last_name_english VARCHAR(255),
    relative_last_name_local VARCHAR(255) ,
    state VARCHAR(255) NOT NULL,
    parliamentary_constituency VARCHAR(255) NOT NULL,
    assembly_constituency VARCHAR(255) NOT NULL,
    polling_station VARCHAR(255) NOT NULL,
    part_number_name VARCHAR(255) NOT NULL,
    part_serial_number INT NOT NULL,
    fetch_status VARCHAR(50) NOT NULL, -- required for organisation not user centric
    fetch_attempts INT DEFAULT 0, -- required for organisation not user centric
    error_message TEXT, -- required for organisation not user centric
    last_attempt DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_epic_number (epic_number)
)
`;

export const VOTER_TABLE = 'voter_details';

export interface Voter extends RowDataPacket {
    id: number;
    epic_number: string;
    first_name_english: string;
    first_name_local: string;
    last_name_english: string;
    last_name_local: string;
    gender: string;
    age: number;
    relative_first_name_english: string;
    relative_first_name_local: string;
    relative_last_name_english: string;
    relative_last_name_local: string;
    state: string;
    parliamentary_constituency: string;
    assembly_constituency: string;
    polling_station: string;
    part_number_name: string;
    part_serial_number: number;
    fetch_status: string;
    fetch_attempts: number;
    error_message: string;
    last_attempt: Date;
    created_at: Date;
}