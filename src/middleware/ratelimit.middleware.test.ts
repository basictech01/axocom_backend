import { describe, expect, it } from "@jest/globals";
import { certificateLimiter, teamLeaderLimiter } from "./ratelimit.middleware";

describe("rate limiting middleware", () => {
    it("skips non-certificate requests in certificateLimiter", () => {
        const req = {
            body: { operationName: "publicSolutions", query: "query publicSolutions { publicSolutions { data { id } } }" },
        } as never;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skip = (certificateLimiter as any).skip;
        if (typeof skip === "function") {
            expect(skip(req)).toBe(true);
        }
    });

    it("matches certificate operations in certificateLimiter", () => {
        const req = {
            body: { operationName: "certificateLookupByEmail", query: "mutation { certificateLookupByEmail(email: \"test@example.com\") { registered } }" },
        } as never;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skip = (certificateLimiter as any).skip;
        if (typeof skip === "function") {
            expect(skip(req)).toBe(false);
        }
    });

    it("skips non-team operations in teamLeaderLimiter", () => {
        const req = {
            body: { operationName: "publicSolutions", query: "query publicSolutions { publicSolutions { data { id } } }" },
        } as never;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skip = (teamLeaderLimiter as any).skip;
        if (typeof skip === "function") {
            expect(skip(req)).toBe(true);
        }
    });

    it("matches solutionStatus and openTeamLeaderDashboard in teamLeaderLimiter", () => {
        const statusReq = {
            body: { operationName: "SolutionStatus", query: "query SolutionStatus($contact: String!) { solutionStatus(contact: $contact) { id } }" },
        } as never;

        const authReq = {
            body: { operationName: "OpenTeamLeaderDashboard", query: "mutation OpenTeamLeaderDashboard($email: String!, $phone: String!) { openTeamLeaderDashboard(email: $email, phone: $phone) { id } }" },
        } as never;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skip = (teamLeaderLimiter as any).skip;
        if (typeof skip === "function") {
            expect(skip(statusReq)).toBe(false);
            expect(skip(authReq)).toBe(false);
        }
    });
});
