import { db } from '../dataconfig/db';
import { err, ok, Result } from "neverthrow";
import createLogger from '../utils/logger';
import { ERRORS, RequestError } from '../utils/error';
import { Party, PARTY_TABLE } from '../models/party.model';


const logger = createLogger('@party.repository');

// Repository class
class PartyRepository {
    /**
     * Get party by ID
     */
    async getById(id: number): Promise<Result<Party | null, RequestError>> {
        try {
            const [rows] = await db.execute<Party[]>(
                `SELECT * FROM ${PARTY_TABLE} WHERE id = ?`,
                [id]
            );

            if (rows.length === 0) {
                return err(ERRORS.PARTY_NOT_FOUND);
            }

            return ok(rows[0]);
        } catch (error) {
            logger.error('Error fetching party by id:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get all political parties
     */
    async getAll(): Promise<Result<Party[], RequestError>> {
        try {
            const [rows] = await db.execute<Party[]>(
                `SELECT * FROM ${PARTY_TABLE} ORDER BY created_at DESC`
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching all political parties:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    // add pagination for getAll later
}

// Export singleton instance
export const partyRepository = new PartyRepository();