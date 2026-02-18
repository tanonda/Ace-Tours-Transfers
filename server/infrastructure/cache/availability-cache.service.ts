/**
 * AvailabilityCacheService - In-memory cache for availability data
 * 
 * Reduces database load for frequently queried tours by caching
 * remaining capacity calculations with TTL-based expiration.
 * 
 * H2 NOTE: This cache is ADVISORY only. The database remains the 
 * single source of truth for all capacity locks and holds.
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

interface CachedAvailability {
    remainingCapacity: number;
    totalCapacity: number;
    cachedAt: number;
}

export class AvailabilityCacheService {
    private cache: Map<string, CacheEntry<CachedAvailability>>;
    private defaultTTL: number; // milliseconds

    constructor(ttlSeconds: number = 60) {
        this.cache = new Map();
        this.defaultTTL = ttlSeconds * 1000;

        // Clean up expired entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Generate cache key for a specific tour instance
     */
    private generateKey(tourId: string, date: string, slot?: string): string {
        return `${tourId}:${date}:${slot || 'default'}`;
    }

    /**
     * Get cached availability if still valid
     */
    get(tourId: string, date: string, slot?: string): CachedAvailability | null {
        const key = this.generateKey(tourId, date, slot);
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Store availability in cache with TTL
     */
    set(
        tourId: string,
        date: string,
        remainingCapacity: number,
        totalCapacity: number,
        slot?: string,
        customTTL?: number
    ): void {
        const key = this.generateKey(tourId, date, slot);
        const ttl = customTTL ? customTTL * 1000 : this.defaultTTL;

        this.cache.set(key, {
            data: {
                remainingCapacity,
                totalCapacity,
                cachedAt: Date.now(),
            },
            expiresAt: Date.now() + ttl,
        });
    }

    /**
     * Invalidate cache for a specific tour instance
     */
    invalidate(tourId: string, date: string, slot?: string): void {
        const key = this.generateKey(tourId, date, slot);
        this.cache.delete(key);
    }

    /**
     * Invalidate all cache entries for a tour (all dates/slots)
     */
    invalidateTour(tourId: string): void {
        const keysToDelete: string[] = [];

        for (const key of this.cache.keys()) {
            if (key.startsWith(`${tourId}:`)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove expired entries from cache
     */
    private cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Get cache statistics for monitoring
     */
    getStats(): { size: number; hitRate?: number } {
        return {
            size: this.cache.size,
        };
    }
}

// Singleton instance
export const availabilityCache = new AvailabilityCacheService(60);
