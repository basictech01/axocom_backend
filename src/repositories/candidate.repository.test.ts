import mysql from 'mysql2/promise';
import { GenericContainer } from 'testcontainers';
import { CANDIDATE_TABLE, CREATE_CANDIDATE_TABLE } from '../models/candidate.model';
import { db } from '../dataconfig/db';
import { candidateRepository } from './candidate.repository';
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
    await connection.query(CREATE_CANDIDATE_TABLE);
    await connection.release();
}

async function tearDownDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(`DROP TABLE IF EXISTS ${CANDIDATE_TABLE}`);
    await connection.release();
}

async function resetCandidateTable() {
    const connection = await mockPool.getConnection();
    await connection.query(`DELETE FROM ${CANDIDATE_TABLE}`);
    await connection.query(`
    INSERT INTO candidates (
      neta_id, name, so_do_wo, age, assembly_constituency, party, name_enrolled_as_voter_in
    ) VALUES
    (1001, 'Candidate One', 'S/O Parent', 45, 'Mumbai North', 'BJP', 'Mumbai North'),
    (1002, 'Candidate Two', 'D/O Parent', 38, 'Mumbai South', 'INC', 'Mumbai South'),
    (1003, 'Candidate Three', 'S/O Parent', 52, 'Pune East', 'AAP', 'Pune East')
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

describe('CandidateRepository', () => {
    it('getById called with existing id; should return Result with candidate', async () => {
        await resetCandidateTable();
        const result = await candidateRepository.getById(1);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const candidate = result.value;
            expect(candidate.id).toBe(1);
            expect(candidate.name).toBe('Candidate One');
            expect(candidate.neta_id).toBe(1001);
            expect(candidate.party).toBe('BJP');
        }
    });

    it('getById called with non-existent id; should return Result.err with CANDIDATE_NOT_FOUND', async () => {
        await resetCandidateTable();
        const result = await candidateRepository.getById(999);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.CANDIDATE_NOT_FOUND);
        }
    });

    it('getAllCandidates should return Result with list of candidates', async () => {
        await resetCandidateTable();
        const result = await candidateRepository.getAllCandidates();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const candidates = result.value;
            expect(candidates).toHaveLength(3);
            expect(candidates[0].name).toBe('Candidate One');
            expect(candidates[1].name).toBe('Candidate Two');
            expect(candidates[2].name).toBe('Candidate Three');
        }
    });

    it('getAllCandidates when table is empty; should return Result with empty array', async () => {
        const connection = await mockPool.getConnection();
        await connection.query(`DELETE FROM ${CANDIDATE_TABLE}`);
        await connection.release();

        const result = await candidateRepository.getAllCandidates();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(0);
        }

        await resetCandidateTable();
    });
});