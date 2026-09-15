import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { createTtlCache } from "./ttl-cache";

describe("createTtlCache", () => {
    afterEach(() => jest.useRealTimers());

    it("shares one load between concurrent callers until the entry expires", async () => {
        jest.useFakeTimers();
        const cache = createTtlCache<number>(30_000);
        const load = jest.fn(async () => 42);

        await expect(Promise.all([cache.get("k", load), cache.get("k", load)])).resolves.toEqual([42, 42]);
        expect(load).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(30_001);
        await cache.get("k", load);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it("does not cache failures and can be cleared", async () => {
        const cache = createTtlCache<number>(30_000);
        await expect(cache.get("k", async () => { throw new Error("db down"); })).rejects.toThrow("db down");
        await expect(cache.get("k", async () => 1)).resolves.toBe(1);

        cache.clear();
        await expect(cache.get("k", async () => 2)).resolves.toBe(2);
    });
});
