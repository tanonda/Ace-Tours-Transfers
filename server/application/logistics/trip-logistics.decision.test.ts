import { describe, it, expect } from 'vitest';
import { decideLogisticsFlags, shouldAlertStaff, toJudgment } from './trip-logistics.decision.js';

const now = new Date('2026-11-12T00:00:00Z');
const all = (p: number) => ({ pickup_place: p, flight_number: p, dietary: p, limited_mobility: p, child_seat: p });
const facts = (requiresFlightInfo: boolean, needsChecked = true) => ({ requiresFlightInfo, needsChecked, model: 'jev-1.14.0', now });

describe('toJudgment', () => {
  it('reads 0.7 and above as yes, 0.3 and below as no, and the band between as unsure', () => {
    expect([0.7, 0.95].map(toJudgment)).toEqual(['yes', 'yes']);
    expect([0.3, 0.02].map(toJudgment)).toEqual(['no', 'no']);
    expect([0.31, 0.5, 0.69].map(toJudgment)).toEqual(['unsure', 'unsure', 'unsure']);
  });
});

describe('decideLogisticsFlags', () => {
  it('marks pickup and flight missing without any answers when the guest typed nothing', () => {
    expect(decideLogisticsFlags(null, { requiresFlightInfo: true, needsChecked: true, model: null, now })).toEqual({
      pickup: 'missing', flight: 'missing', needsChecked: true, needs: [], checkNotes: [], model: null, assessedAt: now.toISOString(),
    });
  });

  it('never asks for a flight on a product that does not need one', () => {
    expect(decideLogisticsFlags(all(0.01), facts(false)).flight).toBe('not_needed');
    expect(decideLogisticsFlags(null, { requiresFlightInfo: false, needsChecked: true, model: null, now }).flight).toBe('not_needed');
  });

  it('maps clear answers to given / missing and lists stated needs', () => {
    const flags = decideLogisticsFlags({ pickup_place: 0.96, flight_number: 0.04, dietary: 0.9, limited_mobility: 0.1, child_seat: 0.8 }, facts(true));
    expect(flags).toMatchObject({ pickup: 'given', flight: 'missing', needs: ['dietary', 'child_seat'], checkNotes: [] });
  });

  it('keeps unsettled answers apart from yes and no', () => {
    const flags = decideLogisticsFlags({ pickup_place: 0.5, flight_number: 0.55, dietary: 0.5, limited_mobility: 0.9, child_seat: 0.1 }, facts(true));
    expect(flags).toMatchObject({ pickup: 'unclear', flight: 'unclear', needs: ['limited_mobility'], checkNotes: ['dietary'] });
  });
});

describe('decideLogisticsFlags — pickup-only mode', () => {
  it('judges pickup and flight from the two pickup answers and records that needs were not checked', () => {
    const flags = decideLogisticsFlags({ pickup_place: 0.9, flight_number: 0.05 }, facts(true, false));
    expect(flags).toMatchObject({ pickup: 'given', flight: 'missing', needsChecked: false, needs: [], checkNotes: [] });
  });

  it('ignores needs answers even if some are supplied', () => {
    const flags = decideLogisticsFlags(all(0.95), facts(true, false));
    expect(flags).toMatchObject({ needsChecked: false, needs: [], checkNotes: [] });
  });
});

describe('shouldAlertStaff', () => {
  it('alerts when a needed flight number is missing or unclear, and not otherwise', () => {
    const withFlight = (p: number, needed: boolean) => decideLogisticsFlags({ ...all(0.01), flight_number: p }, facts(needed));
    expect(shouldAlertStaff(withFlight(0.05, true))).toBe(true);
    expect(shouldAlertStaff(withFlight(0.5, true))).toBe(true);
    expect(shouldAlertStaff(withFlight(0.9, true))).toBe(false);
    expect(shouldAlertStaff(withFlight(0.05, false))).toBe(false);
  });
});
