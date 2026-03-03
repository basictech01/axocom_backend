import { db } from '../dataconfig/db';
import { Voter, VOTER_TABLE } from '../models/voter.model';
import { err, ok, Result } from "neverthrow";
import createLogger from '../utils/logger';
import { ERRORS, RequestError } from '../utils/error';
import { RowDataPacket } from 'mysql2';

const logger = createLogger('@voter.repository');

type VoterAgeBucketRow = RowDataPacket & {
    age_group: string;
    total: number;
};

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

    async getAgeBucketsByState(
        state: string
    ): Promise<Result<VoterAgeBucketRow[], RequestError>> {
        try {
            const [rows] = await db.execute<VoterAgeBucketRow[]>(
                `
                SELECT
                  CASE
                    WHEN age BETWEEN 18 AND 25 THEN '18–25'
                    WHEN age BETWEEN 26 AND 35 THEN '26–35'
                    WHEN age BETWEEN 36 AND 45 THEN '36–45'
                    WHEN age BETWEEN 46 AND 55 THEN '46–55'
                    WHEN age BETWEEN 56 AND 65 THEN '56–65'
                    ELSE '65+'
                  END AS age_group,
                  COUNT(*) AS total
                FROM ${VOTER_TABLE}
                WHERE state = ?
                GROUP BY age_group
                `,
                [state]
            );

            return ok(rows);
        } catch (error) {
            logger.error("Error fetching voter age buckets by state:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }
}

// Export singleton instance
export const voterRepository = new VoterRepository();