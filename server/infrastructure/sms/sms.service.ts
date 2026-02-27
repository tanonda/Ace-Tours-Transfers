/**
 * SmsService
 *
 * Sends SMS messages via a self-hosted Android SMS Gateway
 * (github.com/capcom6/android-sms-gateway) running on a local Android phone
 * with a Digicel/Vodafone Vanuatu SIM.
 *
 * Configuration (environment variables):
 *   SMS_GATEWAY_URL      — e.g. http://192.168.1.50:8080   (local IP of the phone)
 *   SMS_GATEWAY_USER     — username shown in the app
 *   SMS_GATEWAY_PASS     — password shown in the app
 *   SMS_ENABLED          — set to 'true' to enable (default: disabled)
 *   SMS_FROM_NAME        — optional sender label in message prefix e.g. "AceTours"
 *
 * Usage:
 *   import { smsService } from './sms.service.js';
 *   await smsService.send('+6781234567', 'Your booking ACT-04C85720 is confirmed!');
 *
 * If SMS_ENABLED is not 'true' or the gateway is unreachable, the service
 * logs a warning and silently skips — it never throws and never blocks bookings.
 */

interface SmsGatewayResponse {
  id: string;
  state: 'Pending' | 'Processed' | 'Sent' | 'Delivered' | 'Failed';
}

export class SmsService {
  private gatewayUrl: string | null = null;
  private credentials: string | null = null;
  private fromName: string = 'AceTours';
  private isEnabled: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    const url  = process.env.SMS_GATEWAY_URL;
    const user = process.env.SMS_GATEWAY_USER;
    const pass = process.env.SMS_GATEWAY_PASS;
    const enabled = process.env.SMS_ENABLED === 'true';

    if (enabled && url && user && pass) {
      this.gatewayUrl  = url.replace(/\/$/, ''); // strip trailing slash
      this.credentials = Buffer.from(`${user}:${pass}`).toString('base64');
      this.fromName    = process.env.SMS_FROM_NAME || 'AceTours';
      this.isEnabled   = true;
      console.log(`[SMS] Service enabled. Gateway: ${this.gatewayUrl}`);
    } else if (enabled) {
      console.warn('[SMS] SMS_ENABLED=true but SMS_GATEWAY_URL/USER/PASS are missing. SMS disabled.');
    } else {
      console.log('[SMS] Service disabled (SMS_ENABLED not set).');
    }
  }

  /**
   * Send an SMS to one or more phone numbers.
   * Numbers must be in E.164 format: +6781234567
   * Never throws — logs and returns false on failure.
   */
  async send(to: string | string[], message: string): Promise<boolean> {
    // Re-read the gateway URL on every send — this means if the tunnel URL
    // changes (localhost.run restarts) and the env var is updated via Render API,
    // the next SMS pick up the new URL without needing a full server restart.
    const gatewayUrl = process.env.SMS_GATEWAY_URL?.replace(/\/$/, '') || this.gatewayUrl;

    if (!this.isEnabled || !gatewayUrl) {
      console.warn(`[SMS] Skipping SMS (service disabled): ${message.slice(0, 40)}…`);
      return false;
    }

    const phoneNumbers = Array.isArray(to) ? to : [to];

    try {
      const response = await fetch(`${gatewayUrl}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.credentials}`,
        },
        body: JSON.stringify({ message, phoneNumbers }),
        signal: AbortSignal.timeout(10_000), // 10 second timeout
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[SMS] Gateway error ${response.status}: ${body}`);
        return false;
      }

      const data = await response.json() as SmsGatewayResponse;
      console.log(`[SMS] Sent to ${phoneNumbers.join(', ')} — ID: ${data.id}, State: ${data.state}`);
      return true;
    } catch (err: any) {
      // Network error, phone offline, etc — never crash the caller
      console.error(`[SMS] Failed to reach gateway: ${err.message}`);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pre-built message templates — mirrors the pattern in MailingService
  // ─────────────────────────────────────────────────────────────────────────

  /** Sent when a booking is confirmed (payment received) */
  async sendBookingConfirmation(phone: string, data: {
    customerName: string;
    tourName: string;
    date: string;
    bookingRef: string;
    guests: number;
  }): Promise<void> {
    const msg =
      `Hi ${data.customerName}, your booking is CONFIRMED!\n` +
      `Tour: ${data.tourName}\n` +
      `Date: ${data.date}\n` +
      `Guests: ${data.guests}\n` +
      `Ref: ${data.bookingRef}\n` +
      `Questions? Reply to this number.`;
    await this.send(phone, msg);
  }

  /** Sent when a booking is created but awaiting payment */
  async sendBookingPending(phone: string, data: {
    customerName: string;
    tourName: string;
    date: string;
    paymentRef: string;
    amountVUV: number;
  }): Promise<void> {
    const msg =
      `Hi ${data.customerName}, booking received for ${data.tourName} on ${data.date}.\n` +
      `Amount: VT ${data.amountVUV.toLocaleString()}\n` +
      `Payment ref: ${data.paymentRef}\n` +
      `Please include this ref in your bank transfer to confirm.`;
    await this.send(phone, msg);
  }

  /** Sent when a booking is cancelled */
  async sendBookingCancellation(phone: string, data: {
    customerName: string;
    tourName: string;
    date: string;
    bookingRef: string;
  }): Promise<void> {
    const msg =
      `Hi ${data.customerName}, your booking for ${data.tourName} on ${data.date} ` +
      `(Ref: ${data.bookingRef}) has been cancelled. ` +
      `Contact us if you have questions.`;
    await this.send(phone, msg);
  }

  /** Sent to the admin when a new booking comes in */
  async sendAdminNewBooking(adminPhone: string, data: {
    customerName: string;
    tourName: string;
    date: string;
    guests: number;
    amountVUV: number;
    paymentRef: string;
  }): Promise<void> {
    const msg =
      `NEW BOOKING: ${data.customerName}\n` +
      `${data.tourName} — ${data.date}\n` +
      `${data.guests} guests — VT ${data.amountVUV.toLocaleString()}\n` +
      `Ref: ${data.paymentRef}`;
    await this.send(adminPhone, msg);
  }

  /** Reminder sent day before the tour */
  async sendTourReminder(phone: string, data: {
    customerName: string;
    tourName: string;
    date: string;
    pickupTime?: string;
    pickupLocation?: string;
  }): Promise<void> {
    const pickup = data.pickupTime
      ? `\nPickup: ${data.pickupTime}${data.pickupLocation ? ` at ${data.pickupLocation}` : ''}`
      : '';
    const msg =
      `Reminder: ${data.tourName} is TOMORROW (${data.date})!${pickup}\n` +
      `See you then! — AceTours Vanuatu`;
    await this.send(phone, msg);
  }
}

// Singleton — same pattern as mailingService
export const smsService = new SmsService();
