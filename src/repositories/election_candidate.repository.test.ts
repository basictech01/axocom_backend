import mysql from 'mysql2/promise';
import { GenericContainer } from 'testcontainers';
import { ELECTION_CANDIDATE_TABLE } from '../models/election_candidate.model';
import { db } from '../dataconfig/db';
import { electionCandidateRepository } from './election_candidate.repository';
import { ERRORS } from '../utils/error';
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

let mockPool: any;
let container: any;

jest.setTimeout(120000);

jest.mock('../dataconfig/db', () => ({
    get db() {
        return mockPool;
    },
}));

// Same columns as model, no FK so we don't need election/candidate/constituency/party tables
const CREATE_ELECTION_CANDIDATE_TABLE_NO_FK = `
CREATE TABLE election_candidate (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_id INT NOT NULL,
  candidate_id INT NOT NULL,
  constituency_id INT NOT NULL,
  party_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function setupDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(CREATE_ELECTION_CANDIDATE_TABLE_NO_FK);
    await connection.release();
}

async function tearDownDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(`DROP TABLE IF EXISTS ${ELECTION_CANDIDATE_TABLE}`);
    await connection.release();
}

async function resetElectionCandidateTable() {
    const connection = await mockPool.getConnection();
    await connection.query(`DELETE FROM ${ELECTION_CANDIDATE_TABLE}`);
    await connection.query(`
    INSERT INTO election_candidate (election_id, candidate_id, constituency_id, party_id) VALUES
    (1, 1, 1, 1),
    (1, 2, 2, 2),
    (2, 1, 1, 1)
  `);
    await connection.release();
}

beforeAll(async () => {
    container = await new GenericContainer('mysql:latest')
        .withExposedPorts(3306)
        .withEnvironment({
            MYSQL_ROOT_PASSWORD: 'root',
            MYSQL_DATABASE: 'test_db',
            MYSQL_USER: 'test_user',
            MYSQL_PASSWORD: 'test_password',
        })
        .start();

    const port = container.getMappedPort(3306);

    mockPool = mysql.createPool({
        host: 'localhost',
        user: 'test_user',
        password: 'test_password',
        database: 'test_db',
        port,
    });

    await setupDatabase();
});

afterAll(async () => {
    if (mockPool) {
        await tearDownDatabase();
        await mockPool.end();
    }
    if (container) {
        await container.stop();
    }
});

describe('ElectionCandidateRepository', () => {
    it('getById called with existing id; should return Result with election candidate', async () => {
        await resetElectionCandidateTable();
        const result = await electionCandidateRepository.getById(1);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const ec = result.value;
            expect(ec).not.toBeNull();
            expect(ec!.id).toBe(1);
            expect(ec!.election_id).toBe(1);
            expect(ec!.candidate_id).toBe(1);
            expect(ec!.constituency_id).toBe(1);
            expect(ec!.party_id).toBe(1);
        }
    });

    it('getById called with non-existent id; should return Result.err with ELECTION_CANDIDATE_NOT_FOUND', async () => {
        await resetElectionCandidateTable();
        const result = await electionCandidateRepository.getById(999);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.ELECTION_CANDIDATE_NOT_FOUND);
        }
    });

    it('getAll should return Result with list of election candidates', async () => {
        await resetElectionCandidateTable();
        const result = await electionCandidateRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const list = result.value;
            expect(list).toHaveLength(3);
            expect(list[0].election_id).toBe(1);
            expect(list[1].candidate_id).toBe(2);
            expect(list[2].election_id).toBe(2);
        }
    });

    it('getAll when table is empty; should return Result with empty array', async () => {
        const connection = await mockPool.getConnection();
        await connection.query(`DELETE FROM ${ELECTION_CANDIDATE_TABLE}`);
        await connection.release();

        const result = await electionCandidateRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(0);
        }

        await resetElectionCandidateTable();
    });
});