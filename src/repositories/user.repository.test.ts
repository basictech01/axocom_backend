import mysql from 'mysql2/promise';
import { GenericContainer } from 'testcontainers';
import { USER_TABLE, CREATE_USER_TABLE } from '../models/user.model';
import { db } from '../dataconfig/db';
import { userRepository } from './user.repository';
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
    await connection.query(CREATE_USER_TABLE);
    await connection.release();
}

async function tearDownDatabase() {
    const connection = await mockPool.getConnection();
    await connection.query(`DROP TABLE IF EXISTS ${USER_TABLE}`);
    await connection.release();
}

async function resetUserTable() {
    const connection = await mockPool.getConnection();
    await connection.query(`DELETE FROM ${USER_TABLE}`);
    await connection.query(`
    INSERT INTO users (email, password_hash, name) VALUES
    ('alice@example.com', '$2b$10$hash1', 'Alice'),
    ('bob@example.com', '$2b$10$hash2', 'Bob')
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

describe('UserRepository', () => {
    it('getById called with existing id; should return Result with user', async () => {
        await resetUserTable();
        const result = await userRepository.getById(1);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const user = result.value;
            expect(user).not.toBeNull();
            expect(user!.id).toBe(1);
            expect(user!.email).toBe('alice@example.com');
            expect(user!.name).toBe('Alice');
        }
    });

    it('getById called with non-existent id; should return Result.err with RESOURCE_NOT_FOUND', async () => {
        await resetUserTable();
        const result = await userRepository.getById(999);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.RESOURCE_NOT_FOUND);
        }
    });

    it('findByEmail called with existing email; should return Result with user', async () => {
        await resetUserTable();
        const result = await userRepository.findByEmail('bob@example.com');

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).not.toBeNull();
            expect(result.value!.email).toBe('bob@example.com');
            expect(result.value!.name).toBe('Bob');
        }
    });

    it('findByEmail called with non-existent email; should return Result with null', async () => {
        await resetUserTable();
        const result = await userRepository.findByEmail('nobody@example.com');

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toBeNull();
        }
    });

    it('create should insert user and return Result with user', async () => {
        await resetUserTable();
        const result = await userRepository.create({
            email: 'new@example.com',
            password_hash: '$2b$10$newhash',
            name: 'New User',
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const user = result.value;
            expect(user.email).toBe('new@example.com');
            expect(user.name).toBe('New User');
            expect(user.id).toBeDefined();
        }

        const findResult = await userRepository.findByEmail('new@example.com');
        expect(findResult.isOk()).toBe(true);
        if (findResult.isOk()) {
            expect(findResult.value).not.toBeNull();
            expect(findResult.value!.email).toBe('new@example.com');
        }
    });

    it('create with duplicate email; should return Result.err with USER_ALREADY_EXISTS', async () => {
        await resetUserTable();
        const result = await userRepository.create({
            email: 'alice@example.com',
            password_hash: '$2b$10$duplicate',
            name: 'Duplicate',
        });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error).toBe(ERRORS.USER_ALREADY_EXISTS);
        }
    });
});