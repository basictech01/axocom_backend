import mysql from 'mysql2/promise';
import { GenericContainer } from 'testcontainers';
import { CONSTITUENCY_TABLE, CREATE_CONSTITUENCY_TABLE } from '../models/constituency.model';
import { db } from '../dataconfig/db';
import { constituencyRepository } from './constituency.repository';
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
    await connection.query(CREATE_CONSTITUENCY_TABLE);
    await connection.release();
}

async function tearDownDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(`DROP TABLE IF EXISTS ${CONSTITUENCY_TABLE}`);
    await connection.release();
}

async function resetConstituencyTable() {
    const connection = await mockPool.getConnection();
    await connection.query(`DELETE FROM ${CONSTITUENCY_TABLE}`);
    await connection.query(`
    INSERT INTO constituency (name, state, ac_number) VALUES
    ('Mumbai North', 'Maharashtra', 1),
    ('Mumbai South', 'Maharashtra', 2),
    ('Pune East', 'Maharashtra', 3)
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

describe('ConstituencyRepository', () => {
    it('getById called with existing id; should return Result with constituency', async () => {
        await resetConstituencyTable();
        const result = await constituencyRepository.getById(1);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const constituency = result.value;
            expect(constituency).not.toBeNull();
            expect(constituency!.id).toBe(1);
            expect(constituency!.name).toBe('Mumbai North');
            expect(constituency!.state).toBe('Maharashtra');
            expect(constituency!.ac_number).toBe(1);
        }
    });

    it('getById called with non-existent id; should return Result.err with CONSTITUENCY_NOT_FOUND', async () => {
        await resetConstituencyTable();
        const result = await constituencyRepository.getById(999);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.CONSTITUENCY_NOT_FOUND);
        }
    });

    it('getAll should return Result with list of constituencies', async () => {
        await resetConstituencyTable();
        const result = await constituencyRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const constituencies = result.value;
            expect(constituencies).toHaveLength(3);
            expect(constituencies[0].name).toBe('Mumbai North');
            expect(constituencies[1].name).toBe('Mumbai South');
            expect(constituencies[2].name).toBe('Pune East');
        }
    });

    it('getAll when table is empty; should return Result with empty array', async () => {
        const connection = await mockPool.getConnection();
        await connection.query(`DELETE FROM ${CONSTITUENCY_TABLE}`);
        await connection.release();

        const result = await constituencyRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(0);
        }

        await resetConstituencyTable();
    });
});