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
}

export const mailingService = new MailingService();
