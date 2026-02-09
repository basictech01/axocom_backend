import { authResolvers } from './auth.resolver';
import { userRepository } from '../../repositories/user.repository';
import { ok, err } from 'neverthrow';
import { GraphQLError } from 'graphql';
import { ERRORS } from '../../utils/error';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { User } from '../../models/user.model';
import type { GraphQLContext } from '../context';
import { TokenData } from '../../utils/jwt';
import bcrypt from 'bcrypt';

// Mock the repository
jest.mock('../../repositories/user.repository');
const mockRepository = userRepository as jest.Mocked<typeof userRepository>;

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock JWT functions
jest.mock('../../utils/jwt', () => ({
    createAuthToken: jest.fn((data: TokenData) => `auth_token_${data.id}`),
    createRefreshToken: jest.fn((data: TokenData) => `refresh_token_${data.id}`),
}));

// Mock the context module
jest.mock('../context', () => ({
    requireAuth: jest.fn(),
}));

import { requireAuth } from '../context';
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

describe('AuthResolvers', () => {
    const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'Test User',
        created_at: new Date(),
        updated_at: new Date(),
    } as User;

    const mockTokenData: TokenData = {
        id: 1,
        is_admin: false,
        email: 'test@example.com',
        name: 'Test User',
    };

    const mockContext: GraphQLContext = {
        req: {} as any,
        user: mockTokenData,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockRequireAuth.mockReturnValue(mockTokenData);
    });

    describe('Query.me', () => {
        it('should return user view when authenticated', async () => {
            mockRepository.getById.mockResolvedValue(ok(mockUser));

            const result = await authResolvers.Query.me(null, null, mockContext);

            expect(result).toEqual({
                id: 1,
                email: 'test@example.com',
                name: 'Test User',
                created_at: mockUser.created_at,
            });
            expect(mockRequireAuth).toHaveBeenCalledWith(mockContext);
            expect(mockRepository.getById).toHaveBeenCalledWith(1);
        });

        it('should return null when user not found', async () => {
            mockRepository.getById.mockResolvedValue(err(ERRORS.USER_NOT_FOUND));

            const result = await authResolvers.Query.me(null, null, mockContext);

            expect(result).toBeNull();
        });

        it('should throw GraphQLError when not authenticated', async () => {
            const unauthenticatedContext: GraphQLContext = {
                req: {} as any,
                user: null,
            };

            mockRequireAuth.mockImplementation(() => {
                throw new GraphQLError('Unauthorized', {
                    extensions: { code: 'UNAUTHORIZED', statusCode: 401, errorCode: 20005 },
                });
            });

            await expect(
                authResolvers.Query.me(null, null, unauthenticatedContext)
            ).rejects.toThrow(GraphQLError);
        });
    });

    describe('Mutation.signup', () => {
        it('should create user and return tokens', async () => {
            mockBcrypt.hash.mockResolvedValue('$2b$10$hashedpassword' as never);
            mockRepository.create.mockResolvedValue(ok(mockUser));

            const result = await authResolvers.Mutation.signup(null, {
                input: {
                    email: 'new@example.com',
                    password: 'password123',
                    name: 'New User',
                },
            });

            expect(result.token).toBe('auth_token_1');
            expect(result.refresh_token).toBe('refresh_token_1');
            expect(result.user).toEqual({
                id: 1,
                email: 'test@example.com',
                name: 'Test User',
                created_at: mockUser.created_at,
            });
            expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
            expect(mockRepository.create).toHaveBeenCalledWith({
                email: 'new@example.com',
                password_hash: '$2b$10$hashedpassword',
                name: 'New User',
            });
        });

        it('should throw GraphQLError when email or password missing', async () => {
            await expect(
                authResolvers.Mutation.signup(null, {
                    input: { email: '', password: '', name: null },
                })
            ).rejects.toThrow(GraphQLError);

            await expect(
                authResolvers.Mutation.signup(null, {
                    input: { email: 'test@example.com', password: '', name: null },
                })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError when password too short', async () => {
            await expect(
                authResolvers.Mutation.signup(null, {
                    input: { email: 'test@example.com', password: 'short', name: null },
                })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError when user already exists', async () => {
            mockBcrypt.hash.mockResolvedValue('$2b$10$hashedpassword' as never);
            const duplicateError = new Error('EMAIL_ALREADY_EXISTS');
            duplicateError.message = 'EMAIL_ALREADY_EXISTS';
            mockRepository.create.mockResolvedValue(err(ERRORS.USER_ALREADY_EXISTS));

            await expect(
                authResolvers.Mutation.signup(null, {
                    input: {
                        email: 'existing@example.com',
                        password: 'password123',
                        name: 'Existing',
                    },
                })
            ).rejects.toThrow(GraphQLError);
        });
    });

    describe('Mutation.login', () => {
        it('should return tokens when credentials are valid', async () => {
            mockRepository.findByEmail.mockResolvedValue(ok(mockUser));
            mockBcrypt.compare.mockResolvedValue(true as never);

            const result = await authResolvers.Mutation.login(null, {
                input: {
                    email: 'test@example.com',
                    password: 'password123',
                },
            });

            expect(result.token).toBe('auth_token_1');
            expect(result.refresh_token).toBe('refresh_token_1');
            expect(result.user).toEqual({
                id: 1,
                email: 'test@example.com',
                name: 'Test User',
                created_at: mockUser.created_at,
            });
            expect(mockRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
            expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', mockUser.password_hash);
        });

        it('should throw GraphQLError when email or password missing', async () => {
            await expect(
                authResolvers.Mutation.login(null, {
                    input: { email: '', password: '' },
                })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError when user not found', async () => {
            mockRepository.findByEmail.mockResolvedValue(ok(null));

            await expect(
                authResolvers.Mutation.login(null, {
                    input: {
                        email: 'notfound@example.com',
                        password: 'password123',
                    },
                })
            ).rejects.toThrow(GraphQLError);
        });

        it('should throw GraphQLError when password invalid', async () => {
            mockRepository.findByEmail.mockResolvedValue(ok(mockUser));
            mockBcrypt.compare.mockResolvedValue(false as never);

            await expect(
                authResolvers.Mutation.login(null, {
                    input: {
                        email: 'test@example.com',
                        password: 'wrongpassword',
                    },
                })
            ).rejects.toThrow(GraphQLError);
        });
    });
});