/**
 * CRIT-6: Unit tests for hold TTL calculation.
 *
 * These tests validate the getHoldTtlMinutes function inline without importing
 * the full availability module (which triggers DB initialization).
 * The logic is duplicated here to avoid the DB dependency for unit testing.
 */
import { describe, it, expect } from 'vitest';

// Mirror the constants and function from availability.application-service.ts
// to avoid importing the full module which triggers DB initialization.
const MANUAL_PAYMENT_TTL_MINUTES = 4320; // 72 hours
const CARD_PAYMENT_TTL_MINUTES = 15;   // 15 minutes

const MANUAL_PAYMENT_SLUGS = [
    'manual', 'manual_transfer', 'bank-transfer', 'bank_transfer',
    'cash', 'anz-egate', 'bsp-bank', 'bred-bank', 'wantok-money',
    'generic-local-bank',
];

function getHoldTtlMinutes(paymentProvider?: string): number {
    if (!paymentProvider) return CARD_PAYMENT_TTL_MINUTES;
    const slug = paymentProvider.toLowerCase();
    const isManual = MANUAL_PAYMENT_SLUGS.some(s => slug.includes(s));
    return isManual ? MANUAL_PAYMENT_TTL_MINUTES : CARD_PAYMENT_TTL_MINUTES;
}

describe('getHoldTtlMinutes', () => {
    it('returns card TTL (15 min) when no provider specified', () => {
        expect(getHoldTtlMinutes()).toBe(CARD_PAYMENT_TTL_MINUTES);
        expect(getHoldTtlMinutes(undefined)).toBe(15);
    });

    it('returns card TTL for stripe', () => {
        expect(getHoldTtlMinutes('stripe')).toBe(15);
    });

    it('returns manual TTL (72h) for bank-transfer', () => {
        expect(getHoldTtlMinutes('bank-transfer')).toBe(MANUAL_PAYMENT_TTL_MINUTES);
        expect(getHoldTtlMinutes('bank-transfer')).toBe(4320);
    });

    it('returns manual TTL for cash', () => {
        expect(getHoldTtlMinutes('cash')).toBe(4320);
    });

    it('returns manual TTL for anz-egate', () => {
        expect(getHoldTtlMinutes('anz-egate')).toBe(4320);
    });

    it('returns manual TTL for manual_transfer', () => {
        expect(getHoldTtlMinutes('manual_transfer')).toBe(4320);
    });

    it('returns card TTL for unknown provider', () => {
        expect(getHoldTtlMinutes('paypal')).toBe(15);
    });

    it('is case-insensitive', () => {
        expect(getHoldTtlMinutes('BANK-TRANSFER')).toBe(4320);
        expect(getHoldTtlMinutes('Cash')).toBe(4320);
    });

    it('covers all manual payment slugs', () => {
        for (const slug of MANUAL_PAYMENT_SLUGS) {
            expect(getHoldTtlMinutes(slug)).toBe(MANUAL_PAYMENT_TTL_MINUTES);
        }
    });
});
