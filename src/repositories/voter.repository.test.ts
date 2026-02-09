import mysql from 'mysql2/promise';
import { GenericContainer } from 'testcontainers';
import { VOTER_TABLE, CREATE_VOTER_TABLE } from '../models/voter.model';
import { db } from '../dataconfig/db';
import { voterRepository } from './voter.repository';
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
    await connection.query(CREATE_VOTER_TABLE);
    await connection.release();
}

async function tearDownDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(`DROP TABLE IF EXISTS ${VOTER_TABLE}`);
    await connection.release();
}

async function resetVoterTable() {
    const connection = await mockPool.getConnection();
    await connection.query(`DELETE FROM ${VOTER_TABLE}`);
    await connection.query(`
    INSERT INTO voter_details (
      epic_number, first_name_english, first_name_local, last_name_english, last_name_local,
      gender, age, relative_first_name_english, relative_first_name_local,
      relative_last_name_english, relative_last_name_local, state, parliamentary_constituency,
      assembly_constituency, polling_station, part_number_name, part_serial_number,
      fetch_status, fetch_attempts, error_message, last_attempt
    ) VALUES
    ('EPIC001', 'John', 'जॉन', 'Doe', 'डो', 'M', 30, 'Jane', 'जेन', 'Doe', 'डो',
     'Maharashtra', 'Mumbai North', 'Andheri West', 'Station 1', 'Part 1', 123,
     'completed', 1, '', '2025-01-01 10:00:00'),
    ('EPIC002', 'Jane', 'जेन', 'Smith', 'स्मिथ', 'F', 28, 'John', 'जॉन', 'Smith', 'स्मिथ',
     'Maharashtra', 'Mumbai South', 'Bandra East', 'Station 2', 'Part 2', 456,
     'completed', 1, '', '2025-01-01 11:00:00'),
    ('EPIC003', 'Ravi', 'रवि', 'Kumar', 'कुमार', 'M', 35, 'Sita', 'सीता', 'Kumar', 'कुमार',
     'Maharashtra', 'Pune', 'Shivajinagar', 'Station 3', 'Part 3', 789,
     'completed', 1, '', '2025-01-01 12:00:00')
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

describe('VoterRepository', () => {
    it('getById called with existing id; should return Result with voter', async () => {
        await resetVoterTable();
        const result = await voterRepository.getById(1);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const voter = result.value;
            expect(voter).not.toBeNull();
            expect(voter!.id).toBe(1);
            expect(voter!.epic_number).toBe('EPIC001');
            expect(voter!.first_name_english).toBe('John');
        }
    });

    it('getById called with non-existent id; should return Result.err with VOTER_NOT_FOUND', async () => {
        await resetVoterTable();
        const result = await voterRepository.getById(999);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.VOTER_NOT_FOUND);
        }
    });

    it('getAll should return Result with list of voters', async () => {
        await resetVoterTable();
        const result = await voterRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const voters = result.value;
            expect(voters).toHaveLength(3);
            expect(voters[0].epic_number).toBe('EPIC001');
            expect(voters[1].epic_number).toBe('EPIC002');
            expect(voters[2].epic_number).toBe('EPIC003');
        }
    });

    it('getAll when table is empty; should return Result with empty array', async () => {
        const connection = await mockPool.getConnection();
        await connection.query(`DELETE FROM ${VOTER_TABLE}`);
        await connection.release();

        const result = await voterRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(0);
        }

        await resetVoterTable();
    });
});