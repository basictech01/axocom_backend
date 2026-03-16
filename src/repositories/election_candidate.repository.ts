import { db } from '../dataconfig/db';
import { err, ok, Result } from "neverthrow";
import createLogger from '../utils/logger';
import { ERRORS, RequestError } from '../utils/error';
import { ElectionCandidate, ELECTION_CANDIDATE_TABLE } from '../models/election_candidate.model';
import { RowDataPacket } from "mysql2";


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

    /**
     * Get election candidates by party and election year
     */
    async getByPartyAndYear(
        partyId: number,
        year: number
    ): Promise<Result<ElectionCandidate[], RequestError>> {
        try {
            const [rows] = await db.execute<ElectionCandidate[]>(
                `SELECT ec.* FROM ${ELECTION_CANDIDATE_TABLE} ec
                 JOIN election e ON ec.election_id = e.id
                 WHERE ec.party_id = ? AND e.year = ?`,
                [partyId, year]
            );
            return ok(rows);
        } catch (error) {
            logger.error('Error fetching election candidates by party and year:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get distinct election years in which a party contested
     */
    async getDistinctYearsByPartyId(
        partyId: number
    ): Promise<Result<number[], RequestError>> {
        try {
            const [rows] = await db.execute<RowDataPacket[]>(
                `SELECT DISTINCT e.year as year FROM ${ELECTION_CANDIDATE_TABLE} ec
                 JOIN election e ON ec.election_id = e.id
                 WHERE ec.party_id = ?
                 ORDER BY e.year DESC`,
                [partyId]
            );
            return ok(rows.map((r) => Number(r.year)));
        } catch (error) {
            logger.error('Error fetching distinct election years by party:', error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get seats won per election year for a party (aggregate count of Won results per year).
     */
    async getSeatsWonPerYearByPartyId(
        partyId: number
    ): Promise<Result<{ year: number; seatsWon: number }[], RequestError>> {
        try {
            const [rows] = await db.execute<RowDataPacket[]>(
                `SELECT e.year AS year, COUNT(er.id) AS seatsWon
                 FROM ${ELECTION_CANDIDATE_TABLE} ec
                 JOIN election e ON ec.election_id = e.id
                 LEFT JOIN election_result er ON er.election_candidate_id = ec.id AND er.status = 'Won'
                 WHERE ec.party_id = ?
                 GROUP BY e.year
                 ORDER BY e.year ASC`,
                [partyId]
            );
            return ok(
                rows.map((r) => ({
                    year: Number(r.year),
                    seatsWon: Number(r.seatsWon),
                }))
            );
        } catch (error) {
            logger.error("Error fetching seats won per year by party:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }

    /**
     * Get election candidates by a list of IDs
     */
    async getByIds(
        ids: number[]
    ): Promise<Result<ElectionCandidate[], RequestError>> {
        if (!ids.length) {
            return ok([]);
        }

        try {
            const placeholders = ids.map(() => "?").join(",");
            const [rows] = await db.execute<ElectionCandidate[]>(
                `SELECT * FROM ${ELECTION_CANDIDATE_TABLE} WHERE id IN (${placeholders})`,
                ids
            );
            return ok(rows);
        } catch (error) {
            logger.error("Error fetching election candidates by ids:", error);
            return err(ERRORS.DATABASE_ERROR);
        }
    }
}

// Export singleton instance
export const electionCandidateRepository = new ElectionCandidateRepository();