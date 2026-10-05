import { describe, it, expect, vi, beforeEach } from 'vitest';

// Run the transaction callback straight away against a dummy tx.
vi.mock('../../db.js', () => ({ db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) } }));

const createHold = vi.fn();
vi.mock('../availability/availability.application-service.js', () => ({
  AvailabilityApplicationService: class { createHold = createHold; },
}));
vi.mock('../../domain/pricing/PricingEngine.js', () => ({
  PricingEngine: class {
    getTourRate = vi.fn().mockResolvedValue({ pricingType: 'per_person' });
    calculateLineItem = vi.fn().mockResolvedValue({ breakdown: { finalTotalCents: 10000 } });
  },
}));
vi.mock('../pricing/PriceCartService.js', () => ({
  PriceCartService: class {
    priceCart = vi.fn().mockResolvedValue({ totalCents: 10000, items: [] });
  },
}));
vi.mock('../../infrastructure/events/event-dispatcher.js', () => ({ eventDispatcher: { dispatch: vi.fn() } }));

import { CreateBookingFromCartService } from './CreateBookingFromCartService.js';

const REQUEST = {
  sessionId: 'browser-session-1', // what POST /api/bookings passes today (req.sessionID)
  customerName: 'Jo Guest',
  customerEmail: 'guest@example.com',
  items: [{ productId: 'tour-1', adultPax: 2, childPax: 0, infantPax: 0, petPax: 0, date: '2026-10-20' }],
};

let storage: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  let holdCount = 0;
  createHold.mockReset().mockImplementation(async () => ({ id: `hold-${++holdCount}` }));
  storage = {
    getProduct: vi.fn().mockResolvedValue({ id: 'tour-1', title: 'Blue Lagoon', isActive: true, category: 'tour' }),
    createBooking: vi.fn().mockImplementation(async (b) => b),
    createBookingItem: vi.fn().mockResolvedValue({}),
  };
});

describe('CreateBookingFromCartService hold groups', () => {
  it("keys the booking's holds to the booking itself", async () => {
    const booking = await new CreateBookingFromCartService(storage as any).execute(REQUEST);
    expect(booking.bookingSessionId).toBe(booking.id);
    expect(createHold).toHaveBeenCalledWith(expect.objectContaining({ sessionId: booking.id }), expect.anything());
  });

  it('gives two bookings from the same guest separate hold groups', async () => {
    const service = new CreateBookingFromCartService(storage as any);
    const first = await service.execute(REQUEST);
    const second = await service.execute(REQUEST);
    expect(first.bookingSessionId).not.toBe(second.bookingSessionId);
  });
});
