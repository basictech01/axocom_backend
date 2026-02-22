import { RowDataPacket } from "mysql2";

export const CREATE_ELECTION_CANDIDATE_TABLE = `
CREATE TABLE election_candidate (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year INT NOT NULL,
    assets BIGINT NOT NULL,
    liabilities BIGINT NOT NULL,
    criminal_cases INT NOT NULL,
    
    pan_itr JSON,
    details_of_criminal_cases JSON,
    details_of_movable_assets JSON,
    details_of_immovable_assets JSON,
    details_of_liabilities JSON,

    election_id INT NOT NULL,
    candidate_id INT NOT NULL,
    constituency_id INT NOT NULL,
    party_id INT NOT NULL,
    votes_polled INT NOT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (election_id) REFERENCES election(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
    FOREIGN KEY (constituency_id) REFERENCES constituency(id),
    FOREIGN KEY (party_id) REFERENCES party(id)
)
`;

export const ELECTION_CANDIDATE_TABLE = 'election_candidate';

export interface ElectionCandidate extends RowDataPacket {
    id: number;
    year: number;
    pan_itr: JSON;
    assets: number;
    liabilities: number;
    criminal_cases: number;
    details_of_criminal_cases: JSON;
    details_of_movable_assets: JSON;
    details_of_immovable_assets: JSON;
    details_of_liabilities: JSON;
    election_id: number;
    candidate_id: number;
    constituency_id: number;
    party_id: number;
    votes_polled: number;
    created_at: Date;
}

