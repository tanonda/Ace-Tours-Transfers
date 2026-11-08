import { useState, useEffect } from 'react';
import { checkAvailability, AvailabilityCheckRequest, AvailabilityCheckResponse } from '../lib/api';
import { availabilityCache, generateAvailabilityKey } from '../lib/availability-cache';

/**
 * useRealtimeAvailability Hook
 * 
 * Synchronizes availability state with the server.
 * Currently uses polling as a baseline, ready for WebSocket integration (Phase 3C).
 */
export function useRealtimeAvailability(
    params: AvailabilityCheckRequest | null,
    options: {
        enabled?: boolean;
        pollingInterval?: number;
        onUpdate?: (data: AvailabilityCheckResponse) => void;
    } = {}
) {
    const [data, setData] = useState<AvailabilityCheckResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const { enabled = true, pollingInterval = 30000, onUpdate } = options;

    const paramsKey = JSON.stringify({
        productId: params?.productId,
        date: params?.date,
        adultPax: params?.adultPax,
        childPax: params?.childPax,
        slot: params?.startTime,
        addonIds: params?.addonIds
    });

    useEffect(() => {
        if (!params || !enabled) {
            if (!params) setData(null);
            return;
        }

        let cancelled = false;

        const cacheKey = generateAvailabilityKey(params.productId, params.date, params);

        const fetchData = async (useCache = true) => {
            if (useCache) {
                const cached = availabilityCache.get(cacheKey);
                if (cached) {
                    if (!cancelled) {
                        setData(cached);
                        onUpdate?.(cached);
                    }
                    return;
                }
            }

            if (!cancelled) setLoading(true);
            try {
                const result = await checkAvailability(params);
                if (cancelled) return;
                setData(result);
                availabilityCache.set(cacheKey, result);
                onUpdate?.(result);
                setError(null);
            } catch (err: any) {
                if (!cancelled) setError(err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();

        const interval = setInterval(() => fetchData(false), pollingInterval);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [paramsKey, enabled, pollingInterval]);

    return { data, loading, error };
}
