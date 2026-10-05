import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlers = new Map<unknown, (event: any) => Promise<void>>();
vi.mock('../../infrastructure/events/event-dispatcher.js', () => ({
  eventDispatcher: { subscribe: (type: unknown, fn: any) => handlers.set(type, fn), dispatch: vi.fn() },
}));
vi.mock('../../infrastructure/mailing/MailingService.js', () => ({
  mailingService: { sendPaymentFailure: vi.fn().mockResolvedValue(undefined), sendPaymentExpiry: vi.fn().mockResolvedValue(undefined) },
}));

import { BookingEventHandler } from './BookingEventHandler.js';
import { PaymentFailed } from '../../domain/events.js';
import { makeBooking } from '../../test-fixtures/payment.js';

let storage: Record<string, ReturnType<typeof vi.fn>>;
let availability: { releaseHold: ReturnType<typeof vi.fn> };

function setup(booking: ReturnType<typeof makeBooking>, groupBookings: { id: string }[], groupHolds: { id: string }[]) {
  storage = {
    getBooking: vi.fn().mockResolvedValue(booking),
    updateBooking: vi.fn().mockResolvedValue({}),
    getBookingsBySession: vi.fn().mockResolvedValue(groupBookings),
    getHoldsBySession: vi.fn().mockResolvedValue(groupHolds),
  };
  availability = { releaseHold: vi.fn().mockResolvedValue(undefined) };
  new BookingEventHandler(storage as any, availability as any).register();
  return handlers.get(PaymentFailed)!;
}

describe('BookingEventHandler — PaymentFailed', () => {
  beforeEach(() => handlers.clear());

  it("releases every seat hold in the failed booking's own group", async () => {
    const booking = makeBooking({ id: 'book_a', holdId: 'hold-1', bookingSessionId: 'book_a' });
    const onFailed = setup(booking, [{ id: 'book_a' }], [{ id: 'hold-1' }, { id: 'hold-2' }]);

    await onFailed(new PaymentFailed('pay-1', 'book_a', 'payzen_refused'));

    expect(availability.releaseHold.mock.calls.map((c) => c[0]).sort()).toEqual(['hold-1', 'hold-2']);
    expect(storage.updateBooking).toHaveBeenCalledWith('book_a', { status: 'failed' });
  });

  it("releases only the booking's own hold when an older booking shares its group", async () => {
    const booking = makeBooking({ id: 'book_a', holdId: 'hold-1', bookingSessionId: 'browser-sess' });
    const onFailed = setup(booking, [{ id: 'book_a' }, { id: 'book_b' }], [{ id: 'hold-1' }, { id: 'hold-b' }]);

    await onFailed(new PaymentFailed('pay-1', 'book_a', 'payzen_refused'));

    expect(availability.releaseHold.mock.calls.map((c) => c[0])).toEqual(['hold-1']);
  });

  it('still marks the booking failed when a hold cannot be released', async () => {
    const booking = makeBooking({ id: 'book_a', holdId: 'hold-1', bookingSessionId: 'book_a' });
    const onFailed = setup(booking, [{ id: 'book_a' }], [{ id: 'hold-1' }]);
    availability.releaseHold.mockRejectedValue(new Error('already released'));

    await onFailed(new PaymentFailed('pay-1', 'book_a', 'payzen_refused'));

    expect(storage.updateBooking).toHaveBeenCalledWith('book_a', { status: 'failed' });
  });
});
