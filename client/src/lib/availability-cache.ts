/**
 * Frontend availability cache with 30-second TTL
 * Reduces redundant API calls during rapid UI interactions.
 */

interface CacheEntry {
    data: any;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 30000; // 30 seconds

export const availabilityCache = {
    get: (key: string) => {
        const entry = cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            cache.delete(key);
            return null;
        }
        return entry.data;
    },
    set: (key: string, data: any, ttl = DEFAULT_TTL) => {
        cache.set(key, {
            data,
            expiresAt: Date.now() + ttl
        });
    },
    invalidate: (key: string) => {
        cache.delete(key);
    },
    clear: () => {
        cache.clear();
    }
};

export const generateAvailabilityKey = (productId: string, date: string, params: any) => {
    // Extract only values that affect availability
    const cleanParams = {
        startTime: params.startTime,
        endTime: params.endTime,
        slot: params.slot
    };
    return `avail:${productId}:${date}:${JSON.stringify(cleanParams)}`;
};
