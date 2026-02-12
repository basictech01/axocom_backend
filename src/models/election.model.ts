import { RowDataPacket } from "mysql2";

export const CREATE_ELECTION_TABLE = `
CREATE TABLE election (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    year INT NOT NULL,
    constituency_id INT NOT NULL,
    FOREIGN KEY (constituency_id) REFERENCES constituency(id),
    type VARCHAR(255) NOT NULL,
    total_voters INT NOT NULL,
    male_voters INT NOT NULL,
    female_voters INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export const ELECTION_TABLE = 'election';

export interface Election extends RowDataPacket {
    id: number;
    name: string;
    start_date: Date;
    end_date: Date;
    year: number;
    constituency_id: number;
    total_voters: number;
    male_voters: number;
    female_voters: number;
    type: string;
    created_at: Date;
}

