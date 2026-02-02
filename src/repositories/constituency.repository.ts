import { db } from '../dataconfig/db';
import { err, ok, Result } from "neverthrow";
import createLogger from '../utils/logger';
import { ERRORS, RequestError } from '../utils/error';
import { Constituency, CONSTITUENCY_TABLE } from '../models/constituency.model';


const logger = createLogger('@constituency.repository');

// Repository class
class ConstituencyRepository {
    /**
     * Get constituency by ID
     */
    async getById(id: number): Promise<Result<Constituency | null, RequestError>> {
        try {
            const [rows] = await db.execute<Constituency[]>(
                `SELECT * FROM ${CONSTITUENCY_TABLE} WHERE id = ?`,
                [id]
            );

            if (rows.length === 0) {
                return err(ERRORS.CONSTITUENCY_NOT_FOUND);
            }

            return ok(rows[0]);
        } catch (error) {
            logger.error('Error fetching constituency by id:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get all constituencies
     */
    async getAll(): Promise<Result<Constituency[], RequestError>> {
        try {
            const [rows] = await db.execute<Constituency[]>(
                `SELECT * FROM ${CONSTITUENCY_TABLE} ORDER BY created_at DESC`
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching all constituencies:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    // add pagination for getAll later
}

// Export singleton instance
export const constituencyRepository = new ConstituencyRepository();