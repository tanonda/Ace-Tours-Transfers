import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlers = new Map<unknown, (event: any) => unknown>();
vi.mock('../../infrastructure/events/event-dispatcher.js', () => ({
  eventDispatcher: { subscribe: (type: unknown, fn: any) => handlers.set(type, fn), dispatch: vi.fn() },
}));
vi.mock('../../storage.js', () => ({ storage: {} }));

import { TripLogisticsService } from './trip-logistics.service.js';
import { BookingCreated } from '../../domain/events.js';
import { makeBooking } from '../../test-fixtures/payment.js';
import { TypeSafeError } from '../../infrastructure/typesafe/system-one.js';

const answers = (over: Record<string, number> = {}) => ({
  model: 'jev-1.14.0', inputTokens: 90,
  answers: { pickup_place: 0.95, flight_number: 0.95, dietary: 0.02, limited_mobility: 0.02, child_seat: 0.02, ...over },
});

let storage: Record<string, ReturnType<typeof vi.fn>>;
let ask: ReturnType<typeof vi.fn>;

function setup(opts: { booking?: Partial<ReturnType<typeof makeBooking>>; flagOn?: boolean; readRequests?: boolean; requiresFlightInfo?: boolean; apiKey?: string | undefined } = {}) {
  const booking = makeBooking({ id: 'book_abcdef123', tourName: 'Airport Transfer', pickupLocation: 'Holiday Inn, flight NF10', notes: null, ...opts.booking });
  storage = {
    getFeatureFlag: vi.fn().mockImplementation(async (slug: string) =>
      slug === 'trip-logistics-special-requests' ? { enabled: opts.readRequests ?? true } : { enabled: opts.flagOn ?? true }),
    getBooking: vi.fn().mockResolvedValue(booking),
    getProduct: vi.fn().mockResolvedValue({ requiresFlightInfo: opts.requiresFlightInfo ?? true }),
    setBookingLogisticsFlags: vi.fn().mockResolvedValue(true),
    createNotification: vi.fn().mockResolvedValue({}),
  };
  ask = vi.fn().mockResolvedValue(answers());
  return new TripLogisticsService(storage as any, 'apiKey' in opts ? opts.apiKey : 'key-123', ask as any);
}

describe('TripLogisticsService', () => {
  beforeEach(() => { handlers.clear(); vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });

  it('does nothing at all while the feature flag is off', async () => {
    const svc = setup({ flagOn: false });
    expect(await svc.assess('book_abcdef123', { alertStaff: true })).toBeNull();
    expect(storage.getBooking).not.toHaveBeenCalled();
    expect(ask).not.toHaveBeenCalled();
    expect(storage.setBookingLogisticsFlags).not.toHaveBeenCalled();
  });

  it('sends only the two text boxes and the service name, never the guest name, email or phone', async () => {
    const svc = setup({ booking: { notes: 'Vegetarian please', customerName: 'Alice Tester', customerEmail: 'alice@example.com', customerPhone: '5551234' } });
    await svc.assess('book_abcdef123', { alertStaff: true });
    const [key, request] = ask.mock.calls[0];
    expect(key).toBe('key-123');
    expect(request.state).toMatchObject({ service_booked: 'Airport Transfer', pickup_hotel_or_flight_box: 'Holiday Inn, flight NF10', special_requests_box: 'Vegetarian please' });
    const sent = JSON.stringify(request);
    for (const secret of ['Alice Tester', 'alice@example.com', '5551234', 'book_abcdef123']) expect(sent).not.toContain(secret);
  });

  describe('pickup-only mode (special-requests flag off)', () => {
    it('never sends the special-requests text and asks only the two pickup questions', async () => {
      const svc = setup({ readRequests: false, booking: { notes: 'Severe peanut allergy, wheelchair user' } });
      const flags = await svc.assess('book_abcdef123', { alertStaff: true });
      const request = ask.mock.calls[0][1];
      expect(Object.keys(request.questions).sort()).toEqual(['flight_number', 'pickup_place']);
      expect(request.state).not.toHaveProperty('special_requests_box');
      const sent = JSON.stringify(request);
      for (const word of ['peanut', 'allergy', 'wheelchair', 'dietary', 'mobility']) expect(sent).not.toContain(word);
      expect(flags).toMatchObject({ pickup: 'given', flight: 'given', needsChecked: false, needs: [], checkNotes: [] });
    });

    it('makes no call when only the special-requests box has text', async () => {
      const svc = setup({ readRequests: false, booking: { pickupLocation: null, notes: 'Vegetarian please' } });
      const flags = await svc.assess('book_abcdef123', { alertStaff: true });
      expect(ask).not.toHaveBeenCalled();
      expect(flags).toMatchObject({ pickup: 'missing', flight: 'missing', needsChecked: false, model: null });
    });

    it('treats a missing special-requests flag row as off', async () => {
      const svc = setup();
      storage.getFeatureFlag.mockImplementation(async (slug: string) => (slug === 'trip-logistics-check' ? { enabled: true } : undefined));
      await svc.assess('book_abcdef123', { alertStaff: true });
      expect(Object.keys(ask.mock.calls[0][1].questions).sort()).toEqual(['flight_number', 'pickup_place']);
    });
  });

  it('asks all five questions when the special-requests flag is on', async () => {
    const svc = setup({ booking: { notes: 'Vegetarian please' } });
    const flags = await svc.assess('book_abcdef123', { alertStaff: true });
    expect(Object.keys(ask.mock.calls[0][1].questions).sort()).toEqual(['child_seat', 'dietary', 'flight_number', 'limited_mobility', 'pickup_place']);
    expect(flags?.needsChecked).toBe(true);
  });

  it('leaves an empty box out of the state', async () => {
    const svc = setup();
    await svc.assess('book_abcdef123', { alertStaff: true });
    expect(ask.mock.calls[0][1].state).not.toHaveProperty('special_requests_box');
  });

  it('stores the flags against the text that was judged and raises no alert when the flight is given', async () => {
    const svc = setup();
    const flags = await svc.assess('book_abcdef123', { alertStaff: true });
    expect(flags).toMatchObject({ pickup: 'given', flight: 'given', model: 'jev-1.14.0' });
    expect(storage.setBookingLogisticsFlags).toHaveBeenCalledWith('book_abcdef123', flags, { pickupLocation: 'Holiday Inn, flight NF10', notes: null });
    expect(storage.createNotification).not.toHaveBeenCalled();
  });

  it('alerts staff when an airport transfer has no flight number', async () => {
    const svc = setup();
    ask.mockResolvedValue(answers({ flight_number: 0.03 }));
    await svc.assess('book_abcdef123', { alertStaff: true });
    expect(storage.createNotification).toHaveBeenCalledTimes(1);
    expect(storage.createNotification.mock.calls[0][0]).toMatchObject({ type: 'warning', title: 'Flight details needed', userId: null });
  });

  it('does not alert for a product that needs no flight details', async () => {
    const svc = setup({ requiresFlightInfo: false });
    ask.mockResolvedValue(answers({ flight_number: 0.03 }));
    const flags = await svc.assess('book_abcdef123', { alertStaff: true });
    expect(flags?.flight).toBe('not_needed');
    expect(storage.createNotification).not.toHaveBeenCalled();
  });

  it('decides an empty booking in code, without calling TypeSafe, and still alerts', async () => {
    const svc = setup({ booking: { pickupLocation: '  ', notes: null } });
    const flags = await svc.assess('book_abcdef123', { alertStaff: true });
    expect(ask).not.toHaveBeenCalled();
    expect(flags).toMatchObject({ pickup: 'missing', flight: 'missing', model: null });
    expect(storage.createNotification).toHaveBeenCalledTimes(1);
  });

  it('treats a failed call as unknown: clears the flags, raises no alert, does not throw', async () => {
    const svc = setup();
    ask.mockRejectedValue(new TypeSafeError('TypeSafe returned HTTP 529', 529));
    expect(await svc.assess('book_abcdef123', { alertStaff: true })).toBeNull();
    expect(storage.setBookingLogisticsFlags).toHaveBeenCalledWith('book_abcdef123', null, expect.anything());
    expect(storage.createNotification).not.toHaveBeenCalled();
  });

  it('does not call out when the flag is on but no API key is set', async () => {
    const svc = setup({ apiKey: undefined });
    expect(await svc.assess('book_abcdef123', { alertStaff: true })).toBeNull();
    expect(ask).not.toHaveBeenCalled();
    expect(storage.createNotification).not.toHaveBeenCalled();
  });

  it('raises no alert when the text changed while it was being judged', async () => {
    const svc = setup();
    ask.mockResolvedValue(answers({ flight_number: 0.03 }));
    storage.setBookingLogisticsFlags.mockResolvedValue(false);
    expect(await svc.assess('book_abcdef123', { alertStaff: true })).toBeNull();
    expect(storage.createNotification).not.toHaveBeenCalled();
  });

  it('updates flags without a new alert when re-assessing after an edit', async () => {
    const svc = setup();
    ask.mockResolvedValue(answers({ flight_number: 0.03 }));
    await svc.assess('book_abcdef123', { alertStaff: false });
    expect(storage.setBookingLogisticsFlags).toHaveBeenCalled();
    expect(storage.createNotification).not.toHaveBeenCalled();
  });

  it('does not make the BookingCreated dispatcher wait for the network call', () => {
    const svc = setup();
    ask.mockReturnValue(new Promise(() => {}));
    svc.register();
    expect(handlers.get(BookingCreated)!(new BookingCreated('book_abcdef123', 25000))).toBeUndefined();
  });
});
