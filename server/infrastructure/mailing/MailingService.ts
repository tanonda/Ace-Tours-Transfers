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
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

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
   * Send a booking confirmation email
   * @param to Recipient email
   * @param bookingDetails Details of the booking
   */
  async sendBookingConfirmation(to: string, bookingDetails: any): Promise<void> {
    if (!this.isEnabled || !this.transporter) {
      console.warn(`[MAILING] Skipping email to ${to} (Service disabled)`);
      return;
    }

    const mailOptions = {
      from: `"Ace Tours Vanuatu" <${process.env.SMTP_FROM || 'no-reply@acetoursvanuatu.com'}>`,
      to,
      subject: `Booking Confirmation - ${bookingDetails.id}`,
      text: `Your booking for ${bookingDetails.tourName} on ${bookingDetails.date} is confirmed!`,
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
    };

    // Send asynchronously - don't await the promise in the main flow if not necessary
    // However, we return the promise so the caller can handle it if they want.
    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`[MAILING] Confirmation email sent to ${to} for booking ${bookingDetails.id}`);
    } catch (error) {
      console.error(`[MAILING][ERROR] Failed to send email to ${to}:`, error);
    }
  }

  /**
   * Send a payment receipt/success email
   */
  async sendPaymentSuccess(to: string, paymentDetails: any): Promise<void> {
    if (!this.isEnabled || !this.transporter) return;

    const mailOptions = {
      from: `"Ace Tours Vanuatu" <${process.env.SMTP_FROM || 'no-reply@acetoursvanuatu.com'}>`,
      to,
      subject: `Payment Successful - Receipt for ${paymentDetails.bookingId}`,
      html: `
        <h1>Payment Received</h1>
        <p>Your payment of <strong>${paymentDetails.amount}</strong> was successful.</p>
        <p><strong>Booking Reference:</strong> ${paymentDetails.bookingId}</p>
        <p><strong>Transaction ID:</strong> ${paymentDetails.transactionId || 'N/A'}</p>
        <p>You will receive a separate email with your booking details shortly.</p>
      `,
    };

    await this.transporter.sendMail(mailOptions).catch(err => console.error("[MAILING][ERROR]", err));
  }

  /**
   * Send a payment failure notification
   */
  async sendPaymentFailure(to: string, paymentDetails: any): Promise<void> {
    if (!this.isEnabled || !this.transporter) return;

    const mailOptions = {
      from: `"Ace Tours Vanuatu" <${process.env.SMTP_FROM || 'no-reply@acetoursvanuatu.com'}>`,
      to,
      subject: `Payment Failed - action required`,
      html: `
        <h1>Payment Attempt Failed</h1>
        <p>We were unable to process your payment for booking ${paymentDetails.bookingId}.</p>
        <p><strong>Reason:</strong> ${paymentDetails.reason || 'Payment was declined by the gateway.'}</p>
        <p>Please try again using a different payment method or contact us for assistance.</p>
      `,
    };

    await this.transporter.sendMail(mailOptions).catch(err => console.error("[MAILING][ERROR]", err));
  }

  /**
   * Send a payment expiry notification
   */
  async sendPaymentExpiry(to: string, bookingId: string): Promise<void> {
    if (!this.isEnabled || !this.transporter) return;

    const mailOptions = {
      from: `"Ace Tours Vanuatu" <${process.env.SMTP_FROM || 'no-reply@acetoursvanuatu.com'}>`,
      to,
      subject: `Booking Expired - Payment Timeout`,
      html: `
        <h1>Booking Expired</h1>
        <p>Your pending booking <strong>${bookingId}</strong> has expired because payment was not received within the required timeframe.</p>
        <p>The inventory has been released. If you still wish to book, please start a new checkout.</p>
      `,
    };

    await this.transporter.sendMail(mailOptions).catch(err => console.error("[MAILING][ERROR]", err));
  }
}

export const mailingService = new MailingService();
