import rateLimit from 'express-rate-limit';

export const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
        success: false,
        error: {
            code: 42901,
            message: 'Too many requests, please try again later'
        }
    }
});

// certificateByHash is deliberately absent: hashes carry 192 random bits, so
// opening a shared certificate link cannot be used to guess other certificates,
// and students on one campus network often share a single public IP.
const CERTIFICATE_OPERATIONS = [
    "certificateByEmail",
    "certificateLookupByEmail",
    "registerCertificateParticipant",
    "certificateTeamByLead",
    "addCertificateTeamMember",
];

/** A tighter public limit for certificate registration and lookup only. */
export const certificateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const operationName = typeof req.body?.operationName === "string" ? req.body.operationName : "";
        const query = typeof req.body?.query === "string" ? req.body.query : "";
        return !CERTIFICATE_OPERATIONS.some(
            (operation) => operationName === operation || query.includes(operation),
        );
    },
    message: {
        errors: [{
            message: "Too many certificate requests. Please try again later.",
            extensions: { code: "RATE_LIMITED", statusCode: 429 },
        }],
    },
});
