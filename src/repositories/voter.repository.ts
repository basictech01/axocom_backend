import { db } from '../dataconfig/db';
import { Voter, VOTER_TABLE } from '../models/voter.model';
import { err, ok, Result } from "neverthrow";
import createLogger from '../utils/logger';
import { ERRORS, RequestError } from '../utils/error';

const logger = createLogger('@voter.repository');

// Repository class
class VoterRepository {
    /**
     * Get voter by ID
     */
    async getById(id: number): Promise<Result<Voter | null, RequestError>> {
        try {
            const [rows] = await db.execute<Voter[]>(
                `SELECT * FROM ${VOTER_TABLE} WHERE id = ?`,
                [id]
            );

            if (rows.length === 0) {
                return err(ERRORS.VOTER_NOT_FOUND);
            }

            return ok(rows[0]);
        } catch (error) {
            logger.error('Error fetching voter by id:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get all voters
     */
    async getAll(): Promise<Result<Voter[], RequestError>> {
        try {
            const [rows] = await db.execute<Voter[]>(
                `SELECT * FROM ${VOTER_TABLE} ORDER BY created_at DESC`
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching all voters:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    // add pagination for getAll later
}

// Export singleton instance
export const voterRepository = new VoterRepository();