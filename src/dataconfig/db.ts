import mysql from "mysql2/promise";
import { NODE_ENV, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from "../config/env";
import createLogger from "../utils/logger";

const logger = createLogger("@db");
//  Export the pool for queries
export const db = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: Number(DB_PORT),
    waitForConnections: true,
    connectionLimit: 50,
    // mysql2 runs a repeating idle-reaper timer whenever maxIdle is below the
    // connection limit. Avoid leaving that timer open in isolated unit tests.
    maxIdle: NODE_ENV === "test" ? 50 : 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
});

//  Export this function to test DB connection at startup
export const connectToDatabase = async () => {
    try {
        const connection = await db.getConnection();
        await connection.ping(); //  check connection
        connection.release();
        logger.info(`MySQL pool connected successfully in ${NODE_ENV}`);
    } catch (error) {
        logger.error(`Error connecting to MySQL pool: ${String(error)}`);
        process.exit(1);
    }
};
