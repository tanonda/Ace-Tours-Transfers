import nodemailer from 'nodemailer';
import { config } from '../../config.js';

/**
 * MailingService
 * 
 * Handles email delivery for booking confirmations, payment receipts, etc.
 * Uses Nodemailer with asynchronous sending to avoid blocking main flows.
 */
export class MailingService {
  private transporter: nodemailer.Transporter | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    // FIX (MED-1): Support both SMTP_* (preferred) and legacy GMAIL_* env vars
    // so operators only need to configure one set.
    const smtpHost   = process.env.SMTP_HOST   || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined);
    const smtpPort   = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser   = process.env.SMTP_USER   || process.env.GMAIL_USER;
    const smtpPass   = process.env.SMTP_PASS   || process.env.GMAIL_APP_PASSWORD;

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.isEnabled = true;
      console.log('[MAILING] Service initialized with SMTP.');
    } else {
      console.warn('[MAILING] SMTP credentials missing. Mailing service is disabled.');
    }
  }

  /**
   * Send an email to the administrator
   */
  async sendAdminEmail(subject: string, html: string): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'admin@acetours.vu';
    await this.sendEmail({ to: adminEmail, subject, html });
  }

  /**
   * Send an email. Public so that mail.ts can delegate to this single
   * implementation (unified email fix — removes dual-implementation bug).
   */
  async sendEmail(options: nodemailer.SendMailOptions): Promise<void> {
    if (!this.isEnabled || !this.transporter) {
      console.warn(`[MAILING] Skipping email (Service disabled): ${options.subject}`);
      return;
    }

    const MAX_RETRIES = 3;
    let lastError;

    const mailOptions = {
      from: `"Ace Tours Vanuatu" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@acetours.vu'}>`,
      ...options
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.transporter.sendMail(mailOptions);
        console.log(`[MAILING] Email sent successfully (Attempt ${attempt}): ${options.subject}`);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`[MAILING][WARN] Delivery failed (Attempt ${attempt}/${MAX_RETRIES}):`, error);
        if (attempt < MAX_RETRIES) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    console.error(`[MAILING][ERROR] All attempts failed for ${options.subject}:`, lastError);
  }

  /**
   * Send a booking confirmation email using the branded template.
   */
  async sendBookingConfirmation(to: string, bookingDetails: any): Promise<void> {
    // Lazy-import to avoid circular deps at module load time
    const templates = await import('../mailing/email-templates.js');
    const ref = `ACT-${(bookingDetails.id || '').replace(/^book_/i, '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const pax = bookingDetails.guests ? `${bookingDetails.guests} guest${bookingDetails.guests !== 1 ? 's' : ''}` : '1 guest';
    const { subject, html } = templates.bookingConfirmation({
      customerName: bookingDetails.customerName || 'Guest',
      bookingRef: ref,
      tourName: bookingDetails.tourName || 'Your Tour',
      date: bookingDetails.date || 'TBD',
      paxSummary: pax,
      totalFormatted: typeof bookingDetails.totalAmountCents === 'number'
        ? `${Math.round(bookingDetails.totalAmountCents).toLocaleString()} VT`
        : bookingDetails.amount || '',
      paymentMethod: bookingDetails.paymentMethod,
    }, bookingDetails.locale || 'en');
    await this.sendEmail({ to, subject, html });
  }

  /**
   * Send a payment receipt/success email using the branded template.
   */
  async sendPaymentSuccess(to: string, paymentDetails: any): Promise<void> {
    const templates = await import('../mailing/email-templates.js');
    const ref = `ACT-${(paymentDetails.bookingId || '').replace(/^book_/i, '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const { subject, html } = templates.paymentReceipt({
      customerName: paymentDetails.customerName || 'Valued Customer',
      bookingRef: ref,
      amount: paymentDetails.amount || '',
      transactionId: paymentDetails.transactionId,
      method: paymentDetails.method,
    }, paymentDetails.locale || 'en');
    await this.sendEmail({ to, subject, html });
  }

  /**
   * Send a payment failure notification using the branded template.
   */
  async sendPaymentFailure(to: string, paymentDetails: any): Promise<void> {
    const templates = await import('../mailing/email-templates.js');
    const ref = `ACT-${(paymentDetails.bookingId || '').replace(/^book_/i, '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const { subject, html } = templates.paymentFailure({
      customerName: paymentDetails.customerName || 'Valued Customer',
      bookingRef: ref,
      amount: paymentDetails.amount || '',
      reason: paymentDetails.reason,
    }, paymentDetails.locale || 'en');
    await this.sendEmail({ to, subject, html });
  }

  /**
   * Send a payment expiry notification using the branded template.
   */
  async sendPaymentExpiry(to: string, bookingId: string, customerName?: string, locale = 'en'): Promise<void> {
    const templates = await import('../mailing/email-templates.js');
    const ref = `ACT-${(bookingId || '').replace(/^book_/i, '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const { subject, html } = templates.paymentExpiry({
      customerName: customerName || 'Valued Customer',
      bookingRef: ref,
    }, locale);
    await this.sendEmail({ to, subject, html });
  }
}

export const mailingService = new MailingService();
