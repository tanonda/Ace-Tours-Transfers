import { useRef, useEffect } from 'react';
import { useRealtimeAvailability } from './useRealtimeAvailability';
import type { AvailabilityCheckRequest, AvailabilityCheckResponse } from '../lib/api';
import { useToast } from './use-toast';
import {
    type AvailabilityBucket,
    getAvailabilityBucket,
    formatDateTimeLabel,
    buildAvailabilityToast,
} from '../lib/availability-toast-messages';

/**
 * useAvailabilityToast
 *
 * Wraps useRealtimeAvailability and fires contextual toast notifications
 * when the availability status bucket changes. Prevents toast spam on
 * polling re-checks by only firing when the status actually changes.
 *
 * Time-aware: includes startTime in change detection and toast messages,
 * so guests get precise feedback when selecting a specific time slot.
 */
export function useAvailabilityToast(
    params: AvailabilityCheckRequest | null,
    options: {
        enabled?: boolean;
        pollingInterval?: number;
        onUpdate?: (data: AvailabilityCheckResponse) => void;
    } = {}
) {
    const { toast } = useToast();
    const prevBucket = useRef<AvailabilityBucket | null>(null);
    const prevParamsKey = useRef<string>('');

    const result = useRealtimeAvailability(params, options);

    // Track param changes including time — fires fresh toast when date, time, or guest count changes
    const currentParamsKey = params
        ? `${params.productId}-${params.date}-${params.startTime || ''}-${params.adultPax}-${params.childPax}`
        : '';

    useEffect(() => {
        if (!result.data || !params?.date) return;

        const bucket = getAvailabilityBucket(result.data);
        const paramsChanged = currentParamsKey !== prevParamsKey.current;
        const bucketChanged = bucket !== prevBucket.current;

        // Only fire when the bucket actually changes, or when the user picks new params
        if (!bucketChanged && !paramsChanged) return;

        prevBucket.current = bucket;
        prevParamsKey.current = currentParamsKey;

        const label = formatDateTimeLabel(params.date, params.startTime);
        const msg = buildAvailabilityToast(bucket, result.data.remainingCapacity, label, !!params.startTime);

        toast(msg);
    }, [result.data, currentParamsKey]);

    return result;
}
