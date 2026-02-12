import { db } from '../dataconfig/db';
import { err, ok, Result } from "neverthrow";
import createLogger from '../utils/logger';
import { ERRORS, RequestError } from '../utils/error';
import { ELECTION_RESULT_TABLE, ElectionResult } from '../models/election_result.model';


const logger = createLogger('@election_result.repository');

// Repository class
class ElectionResultRepository {
    /**
     * Get election result by ID
     */
    async getById(id: number): Promise<Result<ElectionResult | null, RequestError>> {
        try {
            const [rows] = await db.execute<ElectionResult[]>(
                `SELECT * FROM ${ELECTION_RESULT_TABLE} WHERE id = ?`,
                [id]
            );

            if (rows.length === 0) {
                return err(ERRORS.ELECTION_RESULT_NOT_FOUND);
            }

            return ok(rows[0]);
        } catch (error) {
            logger.error('Error fetching election result by id:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get all election results
     */
    async getAll(): Promise<Result<ElectionResult[], RequestError>> {
        try {
            const [rows] = await db.execute<ElectionResult[]>(
                `SELECT * FROM ${ELECTION_RESULT_TABLE} ORDER BY created_at DESC`
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching all election results:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get election results by constituency ID and election year
     */

    async getByConstituencyIdAndYear(constituencyId: number, electionYear: number): Promise<Result<ElectionResult[], RequestError>> {
        try {
            const [rows] = await db.execute<ElectionResult[]>(
                `SELECT er.* FROM ${ELECTION_RESULT_TABLE} er
                JOIN election_candidate ec ON er.election_candidate_id = ec.id
                JOIN election e ON ec.election_id = e.id
                WHERE ec.constituency_id = ? AND e.year = ?
                ORDER BY er.rank ASC`,
                [constituencyId, electionYear]
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching results by constituency:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }
}

// Export singleton instance
export const electionResultRepository = new ElectionResultRepository();