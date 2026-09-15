import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT ?? "3000";
export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
// Number of reverse proxies in front of the API (e.g. "1" behind one load balancer).
// Without it, every visitor appears to share the proxy's IP address for rate limiting.
export const TRUST_PROXY = process.env.TRUST_PROXY

export const DB_HOST = process.env.DB_HOST ?? "localhost";
export const DB_USER = process.env.DB_USER ?? "root";
export const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
export const DB_NAME = process.env.DB_NAME ?? "axocom";
export const DB_PORT = process.env.DB_PORT ?? "3306";

// Authentication helpers already reject token operations when this is empty.
// Never place a real secret in this tracked configuration module.
export const JWT_SECRET = process.env.JWT_SECRET ?? "";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "36w";

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
export const GST_RATE_BPS = process.env.GST_RATE_BPS ?? "1800";
export const PAYMENT_TEST_AMOUNT_PAISE = process.env.PAYMENT_TEST_AMOUNT_PAISE;
