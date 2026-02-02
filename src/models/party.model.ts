import { RowDataPacket } from "mysql2";

export const CREATE_PARTY_TABLE = `
CREATE TABLE party (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(255) NOT NULL,
    short_name VARCHAR(255) NOT NULL,
    party_type VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

export const PARTY_TABLE = 'party';

export interface Party extends RowDataPacket {
    id: number;
    name: string;
    symbol: string;
    short_name: string;
    party_type: string;
    created_at: Date;
}

