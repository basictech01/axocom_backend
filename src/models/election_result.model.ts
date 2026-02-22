import { RowDataPacket } from "mysql2";

export const CREATE_ELECTION_RESULT_TABLE = `
CREATE TABLE election_result (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_candidate_id INT NOT NULL,
    FOREIGN KEY (election_candidate_id) REFERENCES election_candidate(id),
    votes_polled INT NOT NULL,
    position INT NOT NULL,
    status VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export const ELECTION_RESULT_TABLE = 'election_result';

export interface ElectionResult extends RowDataPacket {
    id: number;
    election_candidate_id: number;
    votes_polled: number;
    position: number;
    status: string;
    created_at: Date;
}

