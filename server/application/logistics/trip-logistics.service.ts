// Reads a booking's free-text pickup and special-request boxes and turns them into staff flags
// (see trip-logistics.decision.ts). Runs after the booking is saved and never blocks or changes it:
// every failure is logged and leaves the booking with no flags rather than wrong ones.
//
// Off unless the `trip-logistics-check` feature flag is enabled AND TYPESAFE_API_KEY is set.

import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated } from "../../domain/events.js";
import { storage as defaultStorage, type IStorage } from "../../storage.js";
import { askNouls } from "../../infrastructure/typesafe/system-one.js";
import { LOGISTICS_MODEL, LOGISTICS_QUESTIONS, buildLogisticsState } from "./trip-logistics.questions.js";
import { decideLogisticsFlags, shouldAlertStaff, type LogisticsFlags } from "./trip-logistics.decision.js";

export const LOGISTICS_FLAG_SLUG = "trip-logistics-check";

type Storage = Pick<IStorage, "getBooking" | "getProduct" | "getFeatureFlag" | "createNotification" | "setBookingLogisticsFlags">;

export class TripLogisticsService {
  constructor(
    private storage: Storage,
    private apiKey: string | undefined,
    private ask: typeof askNouls = askNouls,
  ) {}

  public register(): void {
    // Not awaited: the dispatcher awaits its handlers, and a network call must not delay the booking response.
    eventDispatcher.subscribe(BookingCreated, (event) => {
      void this.assess(event.bookingId, { alertStaff: true });
    });
  }

  /** Re-read the text after a guest or admin edits it. Updates the flags without a new alert. */
  public reassess(bookingId: string): void {
    void this.assess(bookingId, { alertStaff: false });
  }

  /** Never throws. Resolves to the stored flags, or null when nothing was stored. */
  public async assess(bookingId: string, opts: { alertStaff: boolean }): Promise<LogisticsFlags | null> {
    try {
      const flag = await this.storage.getFeatureFlag(LOGISTICS_FLAG_SLUG);
      if (!flag?.enabled) return null;

      const booking = await this.storage.getBooking(bookingId);
      if (!booking) return null;
      const product = await this.storage.getProduct(booking.tourId);
      const requiresFlightInfo = product?.requiresFlightInfo === true;

      const text = { pickupLocation: booking.pickupLocation ?? null, notes: booking.notes ?? null };
      const pickupLocation = (text.pickupLocation ?? "").trim();
      const notes = (text.notes ?? "").trim();

      let flags: LogisticsFlags;
      if (!pickupLocation && !notes) {
        // Nothing to judge: code already knows both are missing, so no data leaves the server.
        flags = decideLogisticsFlags(null, { requiresFlightInfo, model: null, now: new Date() });
      } else {
        if (!this.apiKey) {
          console.warn(`[LOGISTICS] ${LOGISTICS_FLAG_SLUG} is on but TYPESAFE_API_KEY is not set; booking ${bookingId} not assessed`);
          await this.storage.setBookingLogisticsFlags(bookingId, null, text);
          return null;
        }
        let result;
        try {
          result = await this.ask(this.apiKey, {
            model: LOGISTICS_MODEL,
            state: buildLogisticsState({ pickupLocation, notes, productName: booking.tourName }),
            questions: LOGISTICS_QUESTIONS,
          });
        } catch (err: any) {
          // A failed call is unknown, not "no": clear any flags made from older text.
          console.error(`[LOGISTICS] booking ${bookingId} not assessed: ${err?.message}`);
          await this.storage.setBookingLogisticsFlags(bookingId, null, text);
          return null;
        }
        // Answers and token count only: the guest's text is never logged.
        console.log(`[LOGISTICS] booking ${bookingId} model=${result.model} tokens=${result.inputTokens} answers=${JSON.stringify(result.answers)}`);
        flags = decideLogisticsFlags(result.answers, { requiresFlightInfo, model: result.model, now: new Date() });
      }

      // Only stored if the text is still what was judged (the guest may have edited it meanwhile).
      const stored = await this.storage.setBookingLogisticsFlags(bookingId, flags, text);
      if (!stored) return null;

      if (opts.alertStaff && shouldAlertStaff(flags)) {
        await this.storage.createNotification({
          type: "warning",
          title: "Flight details needed",
          message:
            `Booking #${booking.id.slice(0, 8)} (${booking.tourName}, ${booking.date}) ` +
            (flags.flight === "missing" ? "has no flight number." : "may be missing a flight number — please check the pickup text."),
          link: `/admin/bookings`,
          userId: null,
        });
      }
      return flags;
    } catch (err: any) {
      console.error(`[LOGISTICS] booking ${bookingId} failed: ${err?.message}`);
      return null;
    }
  }
}

export const tripLogistics = new TripLogisticsService(defaultStorage, process.env.TYPESAFE_API_KEY);
