import { config } from '../../config.js';

// ─── Interface ────────────────────────────────────────────────────────
export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Any SMS provider adapter must implement this interface.
 */
export interface ISmsProvider {
  readonly name: string;
  sendSms(to: string, message: string): Promise<SmsResult>;
}

// ─── Service ──────────────────────────────────────────────────────────

/**
 * SmsService
 *
 * Provider-agnostic SMS delivery following the same singleton pattern as
 * MailingService.  Reads SMS_PROVIDER env var to select the active adapter.
 * Falls back to ConsoleProvider when nothing is configured (safe for dev).
 */
export class SmsService {
  private provider: ISmsProvider | null = null;
  private isEnabled: boolean = false;
  private adminPhone: string | undefined;

  constructor() {
    this.init();
  }

  // ── Bootstrap ─────────────────────────────────────────────────────
  private async init() {
    const providerName = config.sms.provider;
    this.adminPhone = config.sms.adminPhone;

    try {
      switch (providerName) {
        case 'android_gateway': {
          const { AndroidGatewayProvider } = await import('./providers/AndroidGatewayProvider.js');
          this.provider = new AndroidGatewayProvider(
            config.sms.androidGateway.url!,
            config.sms.androidGateway.apiKey!,
          );
          break;
        }
        case 'twilio': {
          const { TwilioProvider } = await import('./providers/TwilioProvider.js');
          this.provider = new TwilioProvider(
            config.sms.twilio.accountSid!,
            config.sms.twilio.authToken!,
            config.sms.twilio.fromNumber!,
          );
          break;
        }
        case 'console':
        default: {
          const { ConsoleProvider } = await import('./providers/ConsoleProvider.js');
          this.provider = new ConsoleProvider();
          break;
        }
      }

      this.isEnabled = true;
      console.log(`[SMS] Service initialized with provider: ${this.provider!.name}`);
    } catch (err) {
      console.warn('[SMS] Failed to initialise provider. SMS is disabled.', err);
    }
  }

  // ── Core send (with retry) ────────────────────────────────────────
  private async send(to: string, message: string): Promise<SmsResult> {
    if (!this.isEnabled || !this.provider) {
      console.warn(`[SMS] Skipping (service disabled): ${message.slice(0, 60)}…`);
      return { success: false, error: 'SMS service disabled' };
    }

    const MAX_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.provider.sendSms(to, message);
        if (result.success) {
          console.log(`[SMS] Sent (attempt ${attempt}) to ${to}: ${message.slice(0, 60)}…`);
          return result;
        }
        lastError = result.error;
      } catch (error) {
        lastError = error;
      }

      console.warn(`[SMS][WARN] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError);

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }

    console.error(`[SMS][ERROR] All ${MAX_RETRIES} attempts failed for ${to}.`, lastError);
    return { success: false, error: String(lastError) };
  }

  // ── Convenience methods (mirror MailingService) ───────────────────

  async sendBookingConfirmation(phone: string, details: {
    id: string;
    customerName: string;
    tourName: string;
    date: string;
    amount: string;
  }): Promise<SmsResult> {
    const msg = `Hi ${details.customerName}, your booking ${details.id} for "${details.tourName}" on ${details.date} is confirmed! Total: ${details.amount}. — Ace Tours Vanuatu`;
    return this.send(phone, msg);
  }

  async sendPaymentSuccess(phone: string, details: {
    bookingId: string;
    amount: string;
  }): Promise<SmsResult> {
    const msg = `Payment of ${details.amount} received for booking ${details.bookingId}. Thank you! — Ace Tours Vanuatu`;
    return this.send(phone, msg);
  }

  async sendPaymentFailure(phone: string, details: {
    bookingId: string;
    reason?: string;
  }): Promise<SmsResult> {
    const msg = `Payment for booking ${details.bookingId} could not be processed${details.reason ? ': ' + details.reason : ''}. Please try again or contact us. — Ace Tours Vanuatu`;
    return this.send(phone, msg);
  }

  async sendPaymentExpiry(phone: string, bookingId: string): Promise<SmsResult> {
    const msg = `Your booking ${bookingId} has expired because payment was not received in time. Please start a new booking if needed. — Ace Tours Vanuatu`;
    return this.send(phone, msg);
  }

  async sendAdminAlert(message: string): Promise<SmsResult> {
    if (!this.adminPhone) {
      console.warn('[SMS] SMS_ADMIN_PHONE not set. Skipping admin alert.');
      return { success: false, error: 'No admin phone configured' };
    }
    return this.send(this.adminPhone, `[ADMIN ALERT] ${message}`);
  }
}

export const smsService = new SmsService();
