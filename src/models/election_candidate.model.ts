import { RowDataPacket } from "mysql2";

export const CREATE_ELECTION_CANDIDATE_TABLE = `
CREATE TABLE election_candidate (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    FOREIGN KEY (election_id) REFERENCES election(id),
    candidate_id INT NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
    constituency_id INT NOT NULL,
    FOREIGN KEY (constituency_id) REFERENCES constituency(id),
    party_id INT NOT NULL,
    FOREIGN KEY (party_id) REFERENCES party(id),
    -- add more fields here as needed like votes, criminal cases, assets, etc
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export const ELECTION_CANDIDATE_TABLE = 'election_candidate';

export interface ElectionCandidate extends RowDataPacket {
    id: number;
    election_id: number;
    candidate_id: number;
    constituency_id: number;
    party_id: number;
    created_at: Date;
}

