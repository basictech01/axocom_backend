import { db } from '../dataconfig/db';
import { err, ok, Result } from "neverthrow";
import createLogger from '../utils/logger';
import { ERRORS, RequestError } from '../utils/error';
import { ElectionCandidate, ELECTION_CANDIDATE_TABLE } from '../models/election_candidate.model';


const logger = createLogger('@election_candidate.repository');

// Repository class
class ElectionCandidateRepository {
    /**
     * Get election candidate by ID
     */
    async getById(id: number): Promise<Result<ElectionCandidate | null, RequestError>> {
        try {
            const [rows] = await db.execute<ElectionCandidate[]>(
                `SELECT * FROM ${ELECTION_CANDIDATE_TABLE} WHERE id = ?`,
                [id]
            );

            if (rows.length === 0) {
                return err(ERRORS.ELECTION_CANDIDATE_NOT_FOUND);
            }

            return ok(rows[0]);
        } catch (error) {
            logger.error('Error fetching election candidate by id:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get all election candidates
     */
    async getAll(): Promise<Result<ElectionCandidate[], RequestError>> {
        try {
            const [rows] = await db.execute<ElectionCandidate[]>(
                `SELECT * FROM ${ELECTION_CANDIDATE_TABLE} ORDER BY created_at DESC`
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching all election candidates:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get election candidates by constituency and election year
     */
    async getByConstituencyAndYear(
        constituencyId: number,
        electionYear: number
    ): Promise<Result<ElectionCandidate[], RequestError>> {
        const [rows] = await db.execute<ElectionCandidate[]>(
            `SELECT ec.* FROM ${ELECTION_CANDIDATE_TABLE} ec
             JOIN election e ON ec.election_id = e.id
             WHERE ec.constituency_id = ? AND e.year = ?`,
            [constituencyId, electionYear]
        );
        return ok(rows);
    }

    /**
     * Get election candidates by candidate ID
     */

    async getByCandidateId(
        candidateId: number
    ): Promise<Result<ElectionCandidate[], RequestError>> {
        try {
            const [rows] = await db.execute<ElectionCandidate[]>(
                `SELECT ec.*, e.year FROM ${ELECTION_CANDIDATE_TABLE} ec
                 JOIN election e ON ec.election_id = e.id
                 WHERE ec.candidate_id = ?
                 ORDER BY e.year DESC`,
                [candidateId]
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching election candidates by candidate id:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    async getByStateAndYear(state: string, year: number): Promise<Result<ElectionCandidate[], RequestError>> {
        try {
            const [rows] = await db.execute<ElectionCandidate[]>(
                `SELECT ec.* FROM ${ELECTION_CANDIDATE_TABLE} ec
                 JOIN election e ON ec.election_id = e.id
                 JOIN constituency c ON e.constituency_id = c.id
                 WHERE c.state = ? AND e.year = ?
                 ORDER BY ec.id ASC`,
                [state, year]
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching election candidates by state and year:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }
}

// Export singleton instance
export const electionCandidateRepository = new ElectionCandidateRepository();