import mysql from 'mysql2/promise';
import { GenericContainer } from 'testcontainers';
import { ELECTION_RESULT_TABLE } from '../models/election_result.model';
import { db } from '../dataconfig/db';
import { electionResultRepository } from './election_result.repository';
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

// Same columns as model, no FK so we don't need election_candidate table
const CREATE_ELECTION_RESULT_TABLE_NO_FK = `
CREATE TABLE election_result (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_candidate_id INT NOT NULL,
  votes_polled INT NOT NULL,
  \`rank\` INT NOT NULL,
  status VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function setupDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(CREATE_ELECTION_RESULT_TABLE_NO_FK);
    await connection.release();
}

async function tearDownDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(`DROP TABLE IF EXISTS ${ELECTION_RESULT_TABLE}`);
    await connection.release();
}

async function resetElectionResultTable() {
    const connection = await mockPool.getConnection();
    await connection.query(`DELETE FROM ${ELECTION_RESULT_TABLE}`);
    await connection.query(`
    INSERT INTO election_result (election_candidate_id, votes_polled, \`rank\`, status) VALUES
    (1, 50000, 1, 'Won'),
    (2, 35000, 2, 'Lost'),
    (3, 40000, 1, 'Won')
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

describe('ElectionResultRepository', () => {
    it('getById called with existing id; should return Result with election result', async () => {
        await resetElectionResultTable();
        const result = await electionResultRepository.getById(1);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const er = result.value;
            expect(er).not.toBeNull();
            expect(er!.id).toBe(1);
            expect(er!.election_candidate_id).toBe(1);
            expect(er!.votes_polled).toBe(50000);
            expect(er!.rank).toBe(1);
            expect(er!.status).toBe('Won');
        }
    });

    it('getById called with non-existent id; should return Result.err with ELECTION_RESULT_NOT_FOUND', async () => {
        await resetElectionResultTable();
        const result = await electionResultRepository.getById(999);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.ELECTION_RESULT_NOT_FOUND);
        }
    });

    it('getAll should return Result with list of election results', async () => {
        await resetElectionResultTable();
        const result = await electionResultRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const list = result.value;
            expect(list).toHaveLength(3);
            expect(list[0].votes_polled).toBe(50000);
            expect(list[1].status).toBe('Lost');
            expect(list[2].rank).toBe(1);
        }
    });

    it('getAll when table is empty; should return Result with empty array', async () => {
        const connection = await mockPool.getConnection();
        await connection.query(`DELETE FROM ${ELECTION_RESULT_TABLE}`);
        await connection.release();

        const result = await electionResultRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(0);
        }

        await resetElectionResultTable();
    });
}); 