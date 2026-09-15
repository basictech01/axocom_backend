/**
 * Tiny in-process cache for public, read-heavy data. Stores the pending promise,
 * so a burst of identical requests shares one database query, and drops failed
 * results so errors are never cached.
 */
export function createTtlCache<T>(ttlMs: number) {
    const entries = new Map<string, { expiresAt: number; value: Promise<T> }>();

    return {
        get(key: string, load: () => Promise<T>): Promise<T> {
            const now = Date.now();
            const cached = entries.get(key);
            if (cached && cached.expiresAt > now) return cached.value;

            const value = load();
            entries.set(key, { expiresAt: now + ttlMs, value });
            value.catch(() => {
                if (entries.get(key)?.value === value) entries.delete(key);
            });
            return value;
        },
        clear() {
            entries.clear();
        },
    };
}
