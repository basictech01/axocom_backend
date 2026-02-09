import mysql from 'mysql2/promise';
import { GenericContainer } from 'testcontainers';
import { ELECTION_TABLE, CREATE_ELECTION_TABLE } from '../models/election.model';
import { db } from '../dataconfig/db';
import { electionRepository } from './election.repository';
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

async function setupDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(CREATE_ELECTION_TABLE);
    await connection.release();
}

async function tearDownDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(`DROP TABLE IF EXISTS ${ELECTION_TABLE}`);
    await connection.release();
}

async function resetElectionTable() {
    const connection = await mockPool.getConnection();
    await connection.query(`DELETE FROM ${ELECTION_TABLE}`);
    await connection.query(`
    INSERT INTO election (name, start_date, end_date, year, type) VALUES
    ('Lok Sabha 2024', '2024-04-19 00:00:00', '2024-06-01 00:00:00', 2024, 'General'),
    ('State Assembly 2023', '2023-10-15 00:00:00', '2023-11-30 00:00:00', 2023, 'State'),
    ('By-election Mumbai North', '2024-01-10 00:00:00', '2024-01-15 00:00:00', 2024, 'By-election')
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

describe('ElectionRepository', () => {
    it('getById called with existing id; should return Result with election', async () => {
        await resetElectionTable();
        const result = await electionRepository.getById(1);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const election = result.value;
            expect(election).not.toBeNull();
            expect(election!.id).toBe(1);
            expect(election!.name).toBe('Lok Sabha 2024');
            expect(election!.year).toBe(2024);
            expect(election!.type).toBe('General');
        }
    });

    it('getById called with non-existent id; should return Result.err with ELECTION_NOT_FOUND', async () => {
        await resetElectionTable();
        const result = await electionRepository.getById(999);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.ELECTION_NOT_FOUND);
        }
    });

    it('getAll should return Result with list of elections', async () => {
        await resetElectionTable();
        const result = await electionRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const elections = result.value;
            expect(elections).toHaveLength(3);
            expect(elections[0].name).toBe('Lok Sabha 2024');
            expect(elections[1].name).toBe('State Assembly 2023');
            expect(elections[2].name).toBe('By-election Mumbai North');
        }
    });

    it('getAll when table is empty; should return Result with empty array', async () => {
        const connection = await mockPool.getConnection();
        await connection.query(`DELETE FROM ${ELECTION_TABLE}`);
        await connection.release();

        const result = await electionRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(0);
        }

        await resetElectionTable();
    });
});