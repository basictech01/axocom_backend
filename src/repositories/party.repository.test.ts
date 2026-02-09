import mysql from 'mysql2/promise';
import { GenericContainer } from 'testcontainers';
import { PARTY_TABLE, CREATE_PARTY_TABLE } from '../models/party.model';
import { db } from '../dataconfig/db';
import { partyRepository } from './party.repository';
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
    await connection.query(CREATE_PARTY_TABLE);
    await connection.release();
}

async function tearDownDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(`DROP TABLE IF EXISTS ${PARTY_TABLE}`);
    await connection.release();
}

async function resetPartyTable() {
    const connection = await mockPool.getConnection();
    await connection.query(`DELETE FROM ${PARTY_TABLE}`);
    await connection.query(`
    INSERT INTO party (name, symbol, short_name, party_type) VALUES
    ('Bharatiya Janata Party', 'Lotus', 'BJP', 'National'),
    ('Indian National Congress', 'Hand', 'INC', 'National'),
    ('Aam Aadmi Party', 'Broom', 'AAP', 'State')
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

describe('PartyRepository', () => {
    it('getById called with existing id; should return Result with party', async () => {
        await resetPartyTable();
        const result = await partyRepository.getById(1);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const party = result.value;
            expect(party).not.toBeNull();
            expect(party!.id).toBe(1);
            expect(party!.name).toBe('Bharatiya Janata Party');
            expect(party!.short_name).toBe('BJP');
        }
    });

    it('getById called with non-existent id; should return Result.err with PARTY_NOT_FOUND', async () => {
        await resetPartyTable();
        const result = await partyRepository.getById(999);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.PARTY_NOT_FOUND);
        }
    });

    it('getAll should return Result with list of parties', async () => {
        await resetPartyTable();
        const result = await partyRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const parties = result.value;
            expect(parties).toHaveLength(3);
            expect(parties[0].name).toBe('Bharatiya Janata Party');
            expect(parties[1].name).toBe('Indian National Congress');
            expect(parties[2].name).toBe('Aam Aadmi Party');
        }
    });

    it('getAll when table is empty; should return Result with empty array', async () => {
        const connection = await mockPool.getConnection();
        await connection.query(`DELETE FROM ${PARTY_TABLE}`);
        await connection.release();

        const result = await partyRepository.getAll();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(0);
        }

        await resetPartyTable();
    });
});