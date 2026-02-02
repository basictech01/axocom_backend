import { RowDataPacket } from "mysql2";

export const CREATE_CONSTITUENCY_TABLE = `
CREATE TABLE constituency (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    ac_number INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export const CONSTITUENCY_TABLE = 'constituency';

export interface Constituency extends RowDataPacket {
    id: number;
    name: string;
    state: string;
    ac_number: number;
    created_at: Date;
}

