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
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'admin@acetoursvanuatu.com';
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
      from: `"Ace Tours Vanuatu" <${process.env.SMTP_FROM || 'no-reply@acetoursvanuatu.com'}>`,
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
   * Send a booking confirmation email
   * @param to Recipient email
   * @param bookingDetails Details of the booking
   */
  async sendBookingConfirmation(to: string, bookingDetails: any): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Booking Confirmation - ${bookingDetails.id}`,
      html: `
        <h1>Booking Confirmation</h1>
        <p>Dear ${bookingDetails.customerName},</p>
        <p>Thank you for booking with Ace Tours Vanuatu!</p>
        <p><strong>Booking ID:</strong> ${bookingDetails.id}</p>
        <p><strong>Tour:</strong> ${bookingDetails.tourName}</p>
        <p><strong>Date:</strong> ${bookingDetails.date}</p>
        <p><strong>Total Amount:</strong> ${bookingDetails.amount}</p>
        <p>We look forward to seeing you!</p>
      `,
    });
  }

  /**
   * Send a payment receipt/success email
   */
  async sendPaymentSuccess(to: string, paymentDetails: any): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Payment Successful - Receipt for ${paymentDetails.bookingId}`,
      html: `
        <h1>Payment Received</h1>
        <p>Your payment of <strong>${paymentDetails.amount}</strong> was successful.</p>
        <p><strong>Booking Reference:</strong> ${paymentDetails.bookingId}</p>
        <p><strong>Transaction ID:</strong> ${paymentDetails.transactionId || 'N/A'}</p>
        <p>You will receive a separate email with your booking details shortly.</p>
      `,
    });
  }

  /**
   * Send a payment failure notification
   */
  async sendPaymentFailure(to: string, paymentDetails: any): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Payment Failed - action required`,
      html: `
        <h1>Payment Attempt Failed</h1>
        <p>We were unable to process your payment for booking ${paymentDetails.bookingId}.</p>
        <p><strong>Reason:</strong> ${paymentDetails.reason || 'Payment was declined by the gateway.'}</p>
        <p>Please try again using a different payment method or contact us for assistance.</p>
      `,
    });
  }

  /**
   * Send a payment expiry notification
   */
  async sendPaymentExpiry(to: string, bookingId: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Booking Expired - Payment Timeout`,
      html: `
        <h1>Booking Expired</h1>
        <p>Your pending booking <strong>${bookingId}</strong> has expired because payment was not received within the required timeframe.</p>
        <p>The inventory has been released. If you still wish to book, please start a new checkout.</p>
      `,
    });
  }
}

export const mailingService = new MailingService();
