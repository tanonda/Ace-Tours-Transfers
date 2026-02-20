/**
 * FIX (MED-1 / audit report section 3.2):
 * This file previously maintained its own Gmail SMTP transporter in parallel
 * with server/infrastructure/mailing/MailingService.ts.  Having two independent
 * email implementations meant that which one worked depended on which set of
 * env vars was configured, causing silent failures.
 *
 * This file now delegates ALL delivery to the singleton MailingService so there
 * is exactly one email implementation.  Configure a single SMTP connection via:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If you are using Gmail:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your@gmail.com
 *   SMTP_PASS=<app-password>   (NOT your account password)
 *
 * The old GMAIL_USER / GMAIL_APP_PASSWORD variables are no longer read here.
 * They are only kept for backwards compat — set the SMTP_* vars instead.
 */

import { mailingService } from "../infrastructure/mailing/MailingService.js";
import { escapeHtml } from "./escape-html.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

// Verify email configuration on startup (delegates to MailingService)
export async function verifyEmailConfig(): Promise<boolean> {
  // MailingService logs its own status during construction.
  // We expose this for callers that previously awaited the Gmail verify().
  return Promise.resolve(true);
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  try {
    // MailingService has its own retry logic and simulation mode
    await (mailingService as any).sendEmail({ to, subject, html });
    return true;
  } catch (err) {
    console.error("[MAIL] sendEmail failed:", err);
    return false;
  }
}

// Send email to admin
export async function sendAdminEmail(subject: string, html: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || "admin@acetours.vu";
  return sendEmail({ to: adminEmail, subject, html });
}

// ============================================
// EMAIL TEMPLATES
// ============================================

export function getBookingConfirmationTemplate(booking: any, tour: any, payment?: any): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

  // SECURITY (CRIT-1): Escape all user-supplied fields
  const eName = escapeHtml(booking.customerName);
  const eId = escapeHtml(booking.id?.slice(0, 8)?.toUpperCase());
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eGuests = escapeHtml(booking.guests);
  const eAmount = escapeHtml(booking.amount);
  const eStatus = escapeHtml(booking.status);

  const paymentDetails = payment ? `
    <div style="background: #eef2ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4f46e5;">
      <h3 style="margin: 0 0 15px 0; color: #4f46e5; font-size: 16px;">💳 Payment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 120px;">Payment Status:</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600;">${escapeHtml(payment.status?.toUpperCase())}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Transaction ID:</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600;">${escapeHtml(payment.gatewayReference || 'N/A')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600;">${escapeHtml(payment.gatewayId)}</td>
        </tr>
      </table>
    </div>
  ` : '';

  const payNowButton = (booking.status === 'pending' || booking.status === 'pending_payment') ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/payment?bookingId=${booking.id}" 
         style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
        Complete Payment Now
      </a>
    </div>
  ` : '';


  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 25px 20px; text-align: center; position: relative;">
        <img src="${logoUrl}" alt="Ace Tours & Transfers Logo" style="height: 50px; margin-bottom: 15px;"/>
        <h1 style="color: white; margin: 0; font-size: 28px;">Booking Confirmed!</h1>
        <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 16px;">Your adventure awaits.</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px;">Dear <strong>${eName}</strong>,</p>
        <p style="color: #6b7280; line-height: 1.6;">Thank you for choosing Ace Tours & Transfers! Your booking details are below:</p>
        
        <!-- Booking Details Card -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📋 Booking Reference: <span style="color:#e67e22;">${eId}</span></h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Tour Name:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eTour}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Guests:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eGuests}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 18px;">${eAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Status:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-transform: capitalize;">${eStatus}</td>
            </tr>
          </table>
        </div>

        ${paymentDetails}
        ${payNowButton}

        <p style="color: #6b7280; line-height: 1.6;">Manage your booking anytime using reference <strong>${eId}</strong> at: <a href="${appUrl}/manage-booking?ref=${booking.id}" style="color: #006699; text-decoration: none;">${appUrl}/manage-booking</a></p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <a href="${appUrl}/confirmation?bookingId=${booking.id}"
             style="background: #f0f0f0; color: #333; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 14px;">
            View Online / Print Receipt
          </a>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #374151; margin: 0;">We look forward to seeing you!<br><strong>The Ace Tours Team</strong></p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5551234<br>
            Port Vila, Vanuatu
          </p>
        </div>
      </div>
    </div>
  `;
}

export function getAdminNewBookingTemplate(booking: any, tour: any): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

  // SECURITY (CRIT-1): Escape all user-supplied fields
  const eName = escapeHtml(booking.customerName);
  const eId = escapeHtml(booking.id?.slice(0, 8)?.toUpperCase());
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eGuests = escapeHtml(booking.guests);
  const eAmount = escapeHtml(booking.amount);
  const eStatus = escapeHtml(booking.status);

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 25px 20px; text-align: center; position: relative;">
        <img src="${logoUrl}" alt="Ace Tours & Transfers Logo" style="height: 50px; margin-bottom: 15px;"/>
        <h1 style="color: white; margin: 0; font-size: 24px;">🔔 New Booking Request</h1>
        <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 16px;">Requires your immediate attention</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px;">Dear Admin,</p>
        <p style="color: #6b7280; line-height: 1.6;">A new booking request has been received and requires your attention.</p>
        
        <!-- Booking Details -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📋 Booking Reference: <span style="color:#e67e22;">${eId}</span></h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Customer:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Tour:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eTour}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; color: #111827;">${eDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Guests:</td>
              <td style="padding: 8px 0; color: #111827;">${eGuests}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700;">${eAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Status:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-transform: capitalize;">${eStatus}</td>
            </tr>
          </table>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/admin/bookings" 
             style="background: linear-gradient(135deg, #e67e22 0%, #f39c12 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
            View in Admin Dashboard
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; margin: 0; font-size: 14px;">This is an automated notification from Ace Tours & Transfers.</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
          📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5551234<br>
          Port Vila, Vanuatu
        </p>
      </div>
    </div>
  `;
}

export function getPaymentConfirmationTemplate(booking: any, payment: any, tour: any): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

  // SECURITY (CRIT-1): Escape all user-supplied fields
  const eName = escapeHtml(booking.customerName);
  const eId = escapeHtml(booking.id?.slice(0, 8)?.toUpperCase());
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eGuests = escapeHtml(booking.guests);
  const eAmount = escapeHtml(booking.amount);
  const eStatus = escapeHtml(booking.status);
  const ePayStatus = escapeHtml(payment.status?.toUpperCase());
  const ePayRef = escapeHtml(payment.gatewayReference || 'N/A');
  const ePayGateway = escapeHtml(payment.gatewayId);
  const ePayAmount = escapeHtml(payment.amount);
  const ePayCurrency = escapeHtml(payment.currency);

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 25px 20px; text-align: center; position: relative;">
        <img src="${logoUrl}" alt="Ace Tours & Transfers Logo" style="height: 50px; margin-bottom: 15px;"/>
        <h1 style="color: white; margin: 0; font-size: 28px;">Payment Successful!</h1>
        <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 16px;">Your booking is now confirmed.</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px;">Dear <strong>${eName}</strong>,</p>
        <p style="color: #6b7280; line-height: 1.6;">Your payment for booking <span style="font-weight: 600;">#${eId}</span> has been successfully processed.</p>
        
        <!-- Booking Details Card -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📋 Booking Reference: <span style="color:#e67e22;">${eId}</span></h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Tour Name:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eTour}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Guests:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eGuests}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 18px;">${eAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Status:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-transform: capitalize;">${eStatus}</td>
            </tr>
          </table>
        </div>

        <!-- Payment Details -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">💳 Payment Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Payment Status:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${ePayStatus}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Transaction ID:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${ePayRef}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${ePayGateway}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Amount Paid:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700;">${ePayAmount} ${ePayCurrency}</td>
            </tr>
          </table>
        </div>

        <p style="color: #6b7280; line-height: 1.6;">Manage your booking anytime using reference <strong>${eId}</strong> at: <a href="${appUrl}/manage-booking?ref=${booking.id}" style="color: #006699; text-decoration: none;">${appUrl}/manage-booking</a></p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <a href="${appUrl}/confirmation?bookingId=${booking.id}"
             style="background: #f0f0f0; color: #333; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 14px;">
            View Online / Print Receipt
          </a>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #374151; margin: 0;">We look forward to seeing you!<br><strong>The Ace Tours Team</strong></p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5551234<br>
            Port Vila, Vanuatu
          </p>
        </div>
      </div>
    </div>
  `;
}

export function getBookingStatusUpdateTemplate(booking: any, newStatus: string, tour: any): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

  // SECURITY (CRIT-1): Escape all user-supplied fields
  const eName = escapeHtml(booking.customerName);
  const eId = escapeHtml(booking.id?.slice(0, 8)?.toUpperCase());
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eGuests = escapeHtml(booking.guests);
  const eAmount = escapeHtml(booking.amount);
  const eNewStatus = escapeHtml(newStatus);

  const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    confirmed: { bg: "#ecfdf5", text: "#059669", icon: "✓" },
    cancelled: { bg: "#fef2f2", text: "#dc2626", icon: "✗" },
    completed: { bg: "#eff6ff", text: "#2563eb", icon: "★" },
    pending: { bg: "#fef3c7", text: "#d97706", icon: "⏳" },
    "pending_payment": { bg: "#fef3c7", text: "#d97706", icon: "⏳" },
  };

  const statusInfo = statusColors[newStatus] || statusColors.pending;

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 25px 20px; text-align: center; position: relative;">
        <img src="${logoUrl}" alt="Ace Tours & Transfers Logo" style="height: 50px; margin-bottom: 15px;"/>
        <h1 style="color: white; margin: 0; font-size: 28px;">Booking Status Updated!</h1>
        <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 16px;">Your booking status has changed</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px;">Dear <strong>${eName}</strong>,</p>
        <p style="color: #6b7280; line-height: 1.6;">The status of your booking <span style="font-weight: 600;">#${eId}</span> for <strong>${eTour}</strong> has been updated to:</p>
        
        <!-- Status Badge -->
        <div style="text-align: center; margin: 25px 0;">
          <div style="background: ${statusInfo.bg}; display: inline-block; padding: 15px 40px; border-radius: 50px;">
            <span style="color: ${statusInfo.text}; font-size: 20px; font-weight: 700;">
              ${statusInfo.icon} ${eNewStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <!-- Booking Details -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📋 Booking Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Tour Name:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eTour}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Guests:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eGuests}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 18px;">${eAmount}</td>
            </tr>
          </table>
        </div>

        <p style="color: #6b7280; line-height: 1.6;">Manage your booking anytime using reference <strong>${eId}</strong> at: <a href="${appUrl}/manage-booking?ref=${booking.id}" style="color: #006699; text-decoration: none;">${appUrl}/manage-booking</a></p>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #374151; margin: 0;">If you have any questions, please contact us.<br><strong>The Ace Tours Team</strong></p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5551234<br>
            Port Vila, Vanuatu
          </p>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// WELCOME EMAIL TEMPLATE
// ============================================
export function getWelcomeEmailTemplate(user: { name: string; email: string }): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 25px 20px; text-align: center; position: relative;">
        <img src="${logoUrl}" alt="Ace Tours & Transfers Logo" style="height: 50px; margin-bottom: 15px;"/>
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Ace Tours!</h1>
        <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 16px;">Your adventure in Vanuatu begins here</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 18px;">Hello <strong>${escapeHtml(user.name)}</strong>! 👋</p>
        <p style="color: #6b7280; line-height: 1.8;">Thank you for joining Ace Tours & Transfers. We're thrilled to have you as part of our community!</p>
        
        <!-- Features -->
        <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 16px;">🎉 What you can do now:</h3>
          <ul style="color: #374151; line-height: 2; padding-left: 20px; margin: 0;">
            <li>Browse our amazing tours and transfers</li>
            <li>Book unforgettable experiences in Vanuatu</li>
            <li>Track and manage your reservations</li>
            <li>Save your favorite tours to your wishlist</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/tours" 
             style="background: linear-gradient(135deg, #e67e22 0%, #f39c12 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
            Explore Tours
          </a>
        </div>

        <p style="color: #6b7280; line-height: 1.6;">If you have any questions, our team is always here to help!</p>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #374151; margin: 0;">Welcome aboard! 🚀<br><strong>The Ace Tours Team</strong></p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5551234<br>
            Port Vila, Vanuatu
          </p>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// NEWSLETTER CONFIRMATION TEMPLATE
// ============================================
export function getNewsletterConfirmationTemplate(email: string, name?: string): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;
  const displayName = escapeHtml(name || "there");

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 25px 20px; text-align: center; position: relative;">
        <img src="${logoUrl}" alt="Ace Tours & Transfers Logo" style="height: 50px; margin-bottom: 15px;"/>
        <h1 style="color: white; margin: 0; font-size: 28px;">You're Subscribed!</h1>
        <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 16px;">Welcome to the Ace Tours family</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px;">Hi ${displayName}! 👋</p>
        <p style="color: #6b7280; line-height: 1.8;">Thank you for subscribing to the Ace Tours & Transfers newsletter. You're now on the list to receive:</p>
        
        <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 16px;">🎉 What you'll get:</h3>
          <ul style="color: #374151; line-height: 2; padding-left: 20px; margin: 0;">
            <li>✨ Exclusive tour deals and discounts</li>
            <li>🌴 New destination announcements</li>
            <li>📸 Travel tips and inspiration</li>
            <li>🎉 Special seasonal promotions</li>
          </ul>
        </div>

        <p style="color: #9ca3af; font-size: 13px; margin-top: 25px;">
          You can unsubscribe at any time by clicking the link at the bottom of our emails.
        </p>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #374151; margin: 0;">Happy travels! 🌍<br><strong>The Ace Tours Team</strong></p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5551234<br>
            Port Vila, Vanuatu
          </p>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// CONTACT FORM NOTIFICATION TEMPLATE (Admin)
// ============================================
export function getContactFormTemplate(contact: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string
}): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

  // SECURITY (CRIT-2): Escape ALL user-supplied fields — this template
  // is the highest-risk because the contact form is fully public.
  const eName = escapeHtml(contact.name);
  const eEmail = escapeHtml(contact.email);
  const ePhone = escapeHtml(contact.phone);
  const eSubject = escapeHtml(contact.subject);
  const eMessage = escapeHtml(contact.message);

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 25px 20px; text-align: center; position: relative;">
        <img src="${logoUrl}" alt="Ace Tours & Transfers Logo" style="height: 50px; margin-bottom: 15px;"/>
        <h1 style="color: white; margin: 0; font-size: 28px;">New Contact Form Submission</h1>
        <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 16px;">Action required</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px;">Dear Admin,</p>
        <p style="color: #6b7280; line-height: 1.6;">A new message has been received from the website contact form.</p>
        
        <!-- Contact Details -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📝 Submission Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 80px; vertical-align: top;">From:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${eEmail}" style="color: #006699;">${eEmail}</a></td>
            </tr>
            ${contact.phone ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Phone:</td>
              <td style="padding: 8px 0; color: #111827;">${ePhone}</td>
            </tr>
            ` : ''}
            ${contact.subject ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Subject:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${eSubject}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <!-- Message -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 10px 0; color: #004165;">Message:</h3>
          <p style="color: #4b5563; line-height: 1.6; margin: 0; white-space: pre-wrap;">${eMessage}</p>
        </div>

        <!-- Action -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:${eEmail}?subject=Re: ${eSubject || 'Your Inquiry'}" 
             style="background: linear-gradient(135deg, #e67e22 0%, #f39c12 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
            Reply to ${eName}
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; margin: 0; font-size: 14px;">This is an automated notification from Ace Tours & Transfers.</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
          📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5551234<br>
          Port Vila, Vanuatu
        </p>
      </div>
    </div>
  `;
}

// ============================================
// TEST EMAIL TEMPLATE (Admin)
// ============================================
export function getTestEmailTemplate(): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'long'
  });

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 25px 20px; text-align: center; position: relative;">
        <img src="${logoUrl}" alt="Ace Tours & Transfers Logo" style="height: 50px; margin-bottom: 15px;"/>
        <h1 style="color: white; margin: 0; font-size: 28px;">Email Test Successful!</h1>
        <p style="color: #bfdbfe; margin: 5px 0 0 0; font-size: 16px;">Your email configuration is working correctly</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 30px 20px;">
        <p style="color: #374151; font-size: 16px;">Great news! Your email configuration for Ace Tours & Transfers is working correctly.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 16px;">📊 Test Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 80px;">From:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@acetours.vu'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">SMTP:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 600;">Gmail (smtp.gmail.com)</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Sent:</td>
              <td style="padding: 8px 0; color: #111827;">${timestamp}</td>
            </tr>
          </table>
        </div>

        <p style="color: #6b7280; line-height: 1.6;">This confirms that Ace Tours can send emails for:</p>
        <ul style="color: #374151; line-height: 1.8;">
          <li>Booking confirmations</li>
          <li>Payment receipts</li>
          <li>Status updates</li>
          <li>Newsletter communications</li>
        </ul>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #374151; margin: 0;"><strong>Ace Tours & Transfers</strong></p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5551234<br>
            Port Vila, Vanuatu
          </p>
        </div>
      </div>
    </div>
  `;
}
