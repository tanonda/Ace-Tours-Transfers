/**
 * FIX (MED-1 / audit report section 3.2):
 * Delegates ALL delivery to the singleton MailingService.
 * Configure via: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import { mailingService } from "../infrastructure/mailing/MailingService.js";
import { escapeHtml } from "./escape-html.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function verifyEmailConfig(): Promise<boolean> {
  return Promise.resolve(true);
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  try {
    await (mailingService as any).sendEmail({ to, subject, html });
    return true;
  } catch (err) {
    console.error("[MAIL] sendEmail failed:", err);
    return false;
  }
}

export async function sendAdminEmail(subject: string, html: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || "admin@acetours.vu";
  return sendEmail({ to: adminEmail, subject, html });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns a clean human-readable booking reference.
 * Booking IDs are `book_<uuid>` — strip prefix and dashes, take 8 chars.
 * e.g. book_04c85720-4a3a-40eb-80ba-bc79d6746aee → ACT-04C85720
 */
export function shortBookingRef(bookingId: string): string {
  return (bookingId || "")
    .replace(/^book_/i, "")
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();
}

async function generateQrDataUrl(bookingId: string): Promise<string> {
  try {
    const appUrl = process.env.APP_URL || "https://acetours.vu";
    const url = `${appUrl}/manage-booking?ref=${bookingId}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 160,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#004165", light: "#ffffff" },
    });
    return dataUrl;
  } catch {
    return "";
  }
}

function qrBlock(dataUrl: string, shortRef: string): string {
  if (!dataUrl) return "";
  return `
    <div style="text-align: center; margin: 28px 0; padding: 20px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px;">
      <p style="color: #004165; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">📱 Quick Check-In QR Code</p>
      <img src="${dataUrl}" alt="Booking QR Code" width="140" height="140"
           style="display: block; margin: 0 auto; border: 3px solid #004165; border-radius: 8px; padding: 6px; background: white;" />
      <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0; line-height: 1.5;">
        Scan to access your booking <strong>ACT-${shortRef}</strong><br/>
        or show this to our team at check-in
      </p>
    </div>`;
}

function emailHeader(logoUrl: string, title: string, subtitle: string): string {
  return `
    <div style="background: linear-gradient(135deg, #004165 0%, #006699 100%); padding: 32px 24px; text-align: center;">
      <img src="${logoUrl}" alt="Ace Tours & Transfers" style="height: 48px; margin-bottom: 18px; display: block; margin-left: auto; margin-right: auto;" />
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">${title}</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 15px;">${subtitle}</p>
    </div>`;
}

function emailFooter(extra = ""): string {
  const phone = process.env.BUSINESS_PHONE || "+678 7744444";
  const email = process.env.BUSINESS_EMAIL || "info@acetours.vu";
  const whatsapp = process.env.WHATSAPP_NUMBER || "6787744444";
  return `
    <div style="margin-top: 32px; padding: 24px; background: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center; border-radius: 0 0 8px 8px;">
      ${extra}
      <p style="color: #374151; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Ace Tours &amp; Transfers Vanuatu</p>
      <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.8;">
        📧 <a href="mailto:${email}" style="color: #9ca3af; text-decoration: none;">${email}</a>
        &nbsp;|&nbsp;
        📞 <a href="tel:${phone}" style="color: #9ca3af; text-decoration: none;">${phone}</a>
        &nbsp;|&nbsp;
        💬 <a href="https://wa.me/${whatsapp}" style="color: #9ca3af; text-decoration: none;">WhatsApp</a>
        <br/>Port Vila, Vanuatu
      </p>
    </div>`;
}

function bookingDetailsRows(eTour: string, eDate: string, eGuests: string, eAmount: string): string {
  return `
    <tr><td style="padding: 9px 0; color: #6b7280; width: 130px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Tour / Service</td><td style="padding: 9px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eTour}</td></tr>
    <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Date</td><td style="padding: 9px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eDate}</td></tr>
    <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Guests</td><td style="padding: 9px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eGuests}</td></tr>
    <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px;">Total Amount</td><td style="padding: 9px 0; color: #059669; font-weight: 700; font-size: 16px;">${eAmount}</td></tr>`;
}

function manageBookingBlock(appUrl: string, bookingId: string, displayRef: string): string {
  return `
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-top: 24px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #0369a1; font-size: 14px;">
        View or update your booking using reference <strong>${displayRef}</strong>
      </p>
      <a href="${appUrl}/manage-booking?ref=${bookingId}"
         style="display: inline-block; background: #0369a1; color: white; padding: 10px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
        Manage My Booking
      </a>
    </div>`;
}

function emailWrapper(content: string): string {
  return `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">${content}</div>`;
}

function refBadge(eId: string, gradient: string, subtextColor: string, subtext: string): string {
  return `
    <div style="background: ${gradient}; border-radius: 10px; padding: 18px 22px; margin-bottom: 24px; text-align: center;">
      <p style="color: ${subtextColor}; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 6px 0;">Booking Reference</p>
      <p style="color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 4px; margin: 0; font-family: 'Courier New', monospace;">ACT-${eId}</p>
      <p style="color: ${subtextColor}; font-size: 11px; margin: 6px 0 0 0; opacity: 0.9;">${subtext}</p>
    </div>`;
}

// =============================================================================
// 1. BOOKING REQUEST RECEIVED (guest email — sent immediately on booking creation)
//    Separate templates for offline (bank transfer / cash) vs online (card)
// =============================================================================
export async function getBookingRequestTemplate(
  booking: any,
  tour: any,
  paymentMethod?: "offline" | "online" | "bank_transfer" | "cash"
): Promise<string> {
  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId     = escapeHtml(shortBookingRef(booking.id));
  const eName   = escapeHtml(booking.customerName);
  const eTour   = escapeHtml(tour.title);
  const eDate   = escapeHtml(booking.date);
  const eGuests = escapeHtml(booking.guests);
  const eAmount = escapeHtml(booking.amount);

  // Pre-generate QR code for embedding in email
  const qrDataUrl = await generateQrDataUrl(booking.id);

  const isCash    = paymentMethod === "cash";
  const isOffline = paymentMethod === "offline" || paymentMethod === "bank_transfer" || isCash;
  const isOnline  = paymentMethod === "online";

  const bankName      = process.env.BANK_NAME || "ANZ Bank (Vanuatu) Ltd";
  const accountName   = process.env.BANK_ACCOUNT_NAME || "Ace Tours &amp; Transfers";
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER || "Contact us for account details";
  const swiftCode     = process.env.BANK_SWIFT_CODE || "";
  const branchCode    = process.env.BANK_BRANCH_CODE || "";
  const waNumber      = process.env.WHATSAPP_NUMBER || "6787744444";

  let paymentBlock = "";

  if (isCash) {
    paymentBlock = `
      <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 16px;">💵 Cash Payment at Pickup</h3>
        <p style="color: #15803d; font-size: 14px; line-height: 1.7; margin: 0 0 8px 0;">
          Please have the exact amount of <strong>${eAmount}</strong> ready at the start of your tour or vehicle pickup.
          Our driver / guide will collect payment from you directly.
        </p>
        <p style="color: #15803d; font-size: 14px; margin: 0;">No further action is needed before your tour date.</p>
      </div>`;
  } else if (isOffline) {
    const bankRows = [
      ["Bank Name", bankName],
      ["Account Name", accountName],
      ["Account Number", accountNumber],
      ...(swiftCode ? [["SWIFT / BIC", swiftCode]] : []),
      ...(branchCode ? [["Branch Code", branchCode]] : []),
      ["Amount", eAmount],
      ["Payment Reference", `ACT-${eId}`],
    ];
    const waMsg = encodeURIComponent(`Hi! I've completed a bank transfer for booking ACT-${eId}. Please confirm receipt.`);
    paymentBlock = `
      <div style="background: #eff6ff; border: 2px solid #93c5fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px;">🏦 Bank Transfer Instructions</h3>
        <p style="color: #1d4ed8; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
          To secure your booking, please transfer <strong>${eAmount}</strong> to the account below.
          <strong>Always use ACT-${eId} as your payment reference</strong> so we can match your transfer quickly.
        </p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; border: 1px solid #bfdbfe;">
          ${bankRows.map(([label, value], i) => `
          <tr>
            <td style="padding: 10px 14px; color: #6b7280; font-size: 13px; width: 140px; ${i < bankRows.length - 1 ? "border-bottom: 1px solid #e0f2fe;" : ""}">${label}</td>
            <td style="padding: 10px 14px; color: #111827; font-weight: ${label === "Payment Reference" || label === "Amount" ? "700" : "600"}; font-size: 13px; ${i < bankRows.length - 1 ? "border-bottom: 1px solid #e0f2fe;" : ""}">${value}</td>
          </tr>`).join("")}
        </table>
        <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 6px; padding: 12px; margin-top: 16px;">
          <p style="color: #854d0e; font-size: 13px; margin: 0;">
            ⏳ <strong>Your booking is held for 72 hours.</strong> Please complete the transfer within this time to secure your spot.
          </p>
        </div>
        <p style="color: #1d4ed8; font-size: 13px; margin: 16px 0 0 0;">
          After transferring, please notify us via
          <a href="https://wa.me/${waNumber}?text=${waMsg}" style="color: #1e40af; font-weight: 600;">WhatsApp</a>
          or email with your transfer receipt so we can confirm promptly.
        </p>
      </div>`;
  } else if (isOnline) {
    paymentBlock = `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${appUrl}/payment?bookingId=${booking.id}"
           style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 16px 44px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(249,115,22,0.35);">
          Complete Payment Now →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 10px;">Secure payment · 256-bit SSL encryption</p>
      </div>`;
  }

  const introText = isCash
    ? "We've received your booking request. Please pay at the start of your tour — no payment is needed now."
    : isOffline
    ? "We've received your booking request. Please complete your bank transfer using the instructions below to secure your spot."
    : isOnline
    ? "We've received your booking request. Please complete your payment to confirm your reservation."
    : "We've received your booking request. Our team will be in touch shortly.";

  return emailWrapper(`
    ${emailHeader(logoUrl, "Booking Request Received", "We've got your booking request")}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">Hi <strong>${eName}</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
        Thank you for choosing Ace Tours &amp; Transfers! ${introText}
      </p>

      ${refBadge(eId, "linear-gradient(135deg, #004165, #006699)", "#bfdbfe", "Keep this reference for your records")}

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">📋 Booking Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${bookingDetailsRows(eTour, eDate, eGuests, eAmount)}
          <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px;">Status</td><td style="padding: 9px 0; font-size: 14px;"><span style="background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 12px;">PENDING</span></td></tr>
        </table>
      </div>

      ${paymentBlock}

      ${qrBlock(qrDataUrl, eId)}

      ${manageBookingBlock(appUrl, booking.id, `ACT-${eId}`)}

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
        Questions? Reply to this email or reach us via WhatsApp.
      </p>
    </div>
    ${emailFooter()}
  `);
}

// =============================================================================
// 2. BOOKING CONFIRMED (sent ONLY when admin changes status to "confirmed")
// =============================================================================
export async function getBookingConfirmedTemplate(booking: any, tour: any): Promise<string> {
  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId          = escapeHtml(shortBookingRef(booking.id));
  const eName        = escapeHtml(booking.customerName);
  const eTour        = escapeHtml(tour.title);
  const eDate        = escapeHtml(booking.date);
  const eGuests      = escapeHtml(booking.guests);
  const eAmount      = escapeHtml(booking.amount);
  const pickupLocation = booking.pickupLocation ? escapeHtml(booking.pickupLocation) : null;
  const notes        = booking.notes ? escapeHtml(booking.notes) : null;

  const qrDataUrl = await generateQrDataUrl(booking.id);

  return emailWrapper(`
    ${emailHeader(logoUrl, "Booking Confirmed! 🎉", "Your adventure is secured")}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">Hi <strong>${eName}</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
        Great news! Your booking has been confirmed by our team. We look forward to seeing you!
      </p>

      ${refBadge(eId, "linear-gradient(135deg, #065f46, #059669)", "#a7f3d0", "✓ Confirmed")}

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">📋 Your Booking</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${bookingDetailsRows(eTour, eDate, eGuests, eAmount)}
          ${pickupLocation ? `<tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Pickup</td><td style="padding: 9px 0; color: #111827; font-size: 14px; border-top: 1px solid #f3f4f6;">${pickupLocation}</td></tr>` : ""}
          ${notes ? `<tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; vertical-align: top; border-top: 1px solid #f3f4f6;">Notes</td><td style="padding: 9px 0; color: #111827; font-size: 14px; border-top: 1px solid #f3f4f6;">${notes}</td></tr>` : ""}
          <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Status</td><td style="padding: 9px 0; font-size: 14px; border-top: 1px solid #f3f4f6;"><span style="background: #d1fae5; color: #065f46; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 12px;">✓ CONFIRMED</span></td></tr>
        </table>
      </div>

      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 18px 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: 700;">📌 Before You Go</h3>
        <ul style="color: #78350f; font-size: 13px; line-height: 2; margin: 0; padding-left: 20px;">
          <li>Please arrive 10 minutes before your scheduled time</li>
          <li>Bring this confirmation email or reference <strong>ACT-${eId}</strong></li>
          <li>Contact us if your plans change — we're happy to help</li>
        </ul>
      </div>

      ${qrBlock(qrDataUrl, eId)}

      ${manageBookingBlock(appUrl, booking.id, `ACT-${eId}`)}
    </div>
    ${emailFooter("<p style=\"color: #374151; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;\">We look forward to seeing you! 🌴</p>")}
  `);
}

// =============================================================================
// Legacy alias — existing callers in payment.application-service pass a payment
// object. Route these correctly based on payment method.
// =============================================================================
export async function getBookingConfirmationTemplate(booking: any, tour: any, payment?: any): Promise<string> {
  if (payment) {
    const slug = (payment.gatewayId || payment.provider || "").toLowerCase();
    const isCash = slug === "cash";
    const isOffline = isCash || slug.includes("bank") || slug.includes("transfer") || slug.includes("manual");
    const method: any = isCash ? "cash" : isOffline ? "bank_transfer" : "online";
    return getBookingRequestTemplate(booking, tour, method);
  }
  return getBookingRequestTemplate(booking, tour);
}

// =============================================================================
// 3. ADMIN — NEW BOOKING REQUEST NOTIFICATION
// =============================================================================
export function getAdminNewBookingTemplate(booking: any, tour: any): string {
  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId     = escapeHtml(shortBookingRef(booking.id));
  const eName   = escapeHtml(booking.customerName);
  const eEmail  = escapeHtml(booking.customerEmail);
  const ePhone  = booking.customerPhone ? escapeHtml(booking.customerPhone) : null;
  const eTour   = escapeHtml(tour.title);
  const eDate   = escapeHtml(booking.date);
  const eGuests = escapeHtml(booking.guests);
  const eAmount = escapeHtml(booking.amount);
  const eStatus = escapeHtml(booking.status);

  return emailWrapper(`
    ${emailHeader(logoUrl, "🔔 New Booking Request", "Action required — review in dashboard")}
    <div style="padding: 28px 28px 12px 28px;">
      <p style="color: #374151; font-size: 15px; margin: 0 0 20px 0;">A new booking request has been received and requires your attention.</p>
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">📋 Booking ACT-${eId}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; width: 130px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Customer</td><td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eName}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Email</td><td style="padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6;"><a href="mailto:${eEmail}" style="color: #006699;">${eEmail}</a></td></tr>
          ${ePhone ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Phone</td><td style="padding: 8px 0; color: #111827; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${ePhone}</td></tr>` : ""}
          ${bookingDetailsRows(eTour, eDate, eGuests, eAmount)}
          <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Status</td><td style="padding: 9px 0; font-size: 14px; border-top: 1px solid #f3f4f6;"><span style="background: #fef3c7; color: #92400e; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">${eStatus.toUpperCase()}</span></td></tr>
        </table>
      </div>
      <div style="text-align: center; margin: 24px 0 28px 0;">
        <a href="${appUrl}/admin/bookings"
           style="display: inline-block; background: linear-gradient(135deg, #e67e22, #f39c12); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
          Review in Admin Dashboard →
        </a>
      </div>
    </div>
    ${emailFooter("<p style=\"color: #6b7280; font-size: 13px; margin: 0 0 16px 0;\">Automated notification from Ace Tours &amp; Transfers.</p>")}
  `);
}

// =============================================================================
// 4. BOOKING STATUS UPDATE (admin changes status)
//    - confirmed → delegates to getBookingConfirmedTemplate (richer)
//    - cancelled, completed → this generic template
// =============================================================================
export async function getBookingStatusUpdateTemplate(booking: any, newStatus: string, tour: any): Promise<string> {
  if (newStatus === "confirmed") {
    return getBookingConfirmedTemplate(booking, tour);
  }

  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId     = escapeHtml(shortBookingRef(booking.id));
  const eName   = escapeHtml(booking.customerName);
  const eTour   = escapeHtml(tour.title);
  const eDate   = escapeHtml(booking.date);
  const eGuests = escapeHtml(booking.guests);
  const eAmount = escapeHtml(booking.amount);

  const statusConfig: Record<string, { bg: string; text: string; icon: string; message: string }> = {
    cancelled: { bg: "#fef2f2", text: "#991b1b", icon: "✗", message: "Your booking has been cancelled. If you did not request this, please contact us immediately." },
    completed: { bg: "#eff6ff", text: "#1e40af", icon: "★", message: "Thank you for choosing Ace Tours &amp; Transfers! We hope you had a wonderful experience." },
    pending:   { bg: "#fef3c7", text: "#92400e", icon: "⏳", message: "Your booking is awaiting confirmation from our team." },
  };
  const s = statusConfig[newStatus] || statusConfig.pending;

  return emailWrapper(`
    ${emailHeader(logoUrl, "Booking Update", "Your booking status has changed")}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">Hi <strong>${eName}</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
        The status of your booking <strong>ACT-${eId}</strong> for <strong>${eTour}</strong> has been updated.
      </p>

      <div style="background: ${s.bg}; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <p style="color: ${s.text}; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 1px;">
          ${s.icon} ${newStatus.replace(/_/g, " ").toUpperCase()}
        </p>
        <p style="color: ${s.text}; font-size: 13px; margin: 10px 0 0 0; opacity: 0.85;">${s.message}</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">📋 Booking Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${bookingDetailsRows(eTour, eDate, eGuests, eAmount)}
        </table>
      </div>

      ${manageBookingBlock(appUrl, booking.id, `ACT-${eId}`)}
    </div>
    ${emailFooter()}
  `);
}

// =============================================================================
// 5. PAYMENT CONFIRMATION (online card payments only — NOT for offline methods)
//    For offline: booking request email already has payment instructions.
//    Confirmed email is sent by admin via status update.
// =============================================================================
export async function getPaymentConfirmationTemplate(booking: any, payment: any, tour: any): Promise<string> {
  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId      = escapeHtml(shortBookingRef(booking.id));
  const eName    = escapeHtml(booking.customerName);
  const eTour    = escapeHtml(tour.title);
  const eDate    = escapeHtml(booking.date);
  const eGuests  = escapeHtml(booking.guests);
  const eAmount  = escapeHtml(booking.amount);
  const ePayRef  = escapeHtml(payment.gatewayReference || "N/A");
  const ePayGw   = escapeHtml(payment.gatewayId || payment.provider || "");
  const ePayAmt  = escapeHtml(String(payment.amount || ""));
  const ePayCurr = escapeHtml(payment.currency || "VUV");

  const qrDataUrl = await generateQrDataUrl(booking.id);

  return emailWrapper(`
    ${emailHeader(logoUrl, "Payment Received ✓", "Your booking is confirmed")}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">Hi <strong>${eName}</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
        Your payment has been received and your booking is confirmed. We look forward to seeing you!
      </p>

      ${refBadge(eId, "linear-gradient(135deg, #065f46, #059669)", "#a7f3d0", "✓ Payment Confirmed")}

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">📋 Booking Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${bookingDetailsRows(eTour, eDate, eGuests, eAmount)}
        </table>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #166534; font-size: 15px; font-weight: 700;">💳 Payment Receipt</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; width: 130px; font-size: 14px; border-bottom: 1px solid #dcfce7;">Transaction ID</td><td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 13px; font-family: monospace; border-bottom: 1px solid #dcfce7;">${ePayRef}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #dcfce7;">Payment Method</td><td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #dcfce7;">${ePayGw}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount Paid</td><td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 16px;">${ePayAmt} ${ePayCurr}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0;">
          This email serves as your payment receipt. Keep reference <strong>ACT-${eId}</strong> for your records.
        </p>
      </div>

      ${qrBlock(qrDataUrl, eId)}

      ${manageBookingBlock(appUrl, booking.id, `ACT-${eId}`)}
    </div>
    ${emailFooter("<p style=\"color: #374151; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;\">We look forward to seeing you! 🌴</p>")}
  `);
}

// =============================================================================
// WELCOME EMAIL
// =============================================================================
export function getWelcomeEmailTemplate(user: { name: string; email: string }): string {
  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;

  return emailWrapper(`
    ${emailHeader(logoUrl, "Welcome to Ace Tours! 🌴", "Your adventure in Vanuatu begins here")}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">Hello <strong>${escapeHtml(user.name)}</strong>! 👋</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0 0 24px 0;">
        Thank you for joining Ace Tours &amp; Transfers. We're thrilled to have you!
      </p>
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; color: #004165; font-size: 15px;">🎉 What you can do now:</h3>
        <ul style="color: #374151; font-size: 14px; line-height: 2.1; padding-left: 20px; margin: 0;">
          <li>Browse our tours and transfers across Vanuatu</li>
          <li>Book unforgettable island experiences</li>
          <li>Track and manage your reservations</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${appUrl}/tours"
           style="display: inline-block; background: linear-gradient(135deg, #e67e22, #f39c12); color: white; padding: 14px 44px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
          Explore Tours →
        </a>
      </div>
    </div>
    ${emailFooter()}
  `);
}

// =============================================================================
// NEWSLETTER CONFIRMATION
// =============================================================================
export function getNewsletterConfirmationTemplate(email: string, name?: string): string {
  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;

  return emailWrapper(`
    ${emailHeader(logoUrl, "You're Subscribed! 🎉", "Welcome to the Ace Tours family")}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">Hi ${escapeHtml(name || "there")}! 👋</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0 0 24px 0;">
        Thank you for subscribing to the Ace Tours &amp; Transfers newsletter!
      </p>
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #004165; font-size: 15px;">📬 You'll receive:</h3>
        <ul style="color: #374151; font-size: 14px; line-height: 2.1; padding-left: 20px; margin: 0;">
          <li>✨ Exclusive tour deals and discounts</li>
          <li>🌴 New destination announcements</li>
          <li>📸 Travel tips and inspiration</li>
          <li>🎉 Special seasonal promotions</li>
        </ul>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
        You can unsubscribe at any time by clicking the link at the bottom of our emails.
      </p>
    </div>
    ${emailFooter()}
  `);
}

// =============================================================================
// CONTACT FORM NOTIFICATION (Admin)
// =============================================================================
export function getContactFormTemplate(contact: {
  name: string; email: string; phone?: string; subject?: string; message: string;
}): string {
  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eName    = escapeHtml(contact.name);
  const eEmail   = escapeHtml(contact.email);
  const ePhone   = contact.phone ? escapeHtml(contact.phone) : null;
  const eSubject = contact.subject ? escapeHtml(contact.subject) : null;
  const eMessage = escapeHtml(contact.message);

  return emailWrapper(`
    ${emailHeader(logoUrl, "New Contact Form Submission", "Action required")}
    <div style="padding: 28px 28px 12px 28px;">
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; width: 80px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">From</td><td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eName}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Email</td><td style="padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6;"><a href="mailto:${eEmail}" style="color: #006699;">${eEmail}</a></td></tr>
          ${ePhone ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Phone</td><td style="padding: 8px 0; color: #111827; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${ePhone}</td></tr>` : ""}
          ${eSubject ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subject</td><td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px;">${eSubject}</td></tr>` : ""}
        </table>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #004165; font-size: 14px; font-weight: 700;">Message:</h3>
        <p style="color: #4b5563; line-height: 1.7; margin: 0; font-size: 14px; white-space: pre-wrap;">${eMessage}</p>
      </div>
      <div style="text-align: center; margin: 24px 0 28px 0;">
        <a href="mailto:${eEmail}?subject=Re: ${eSubject || "Your Inquiry"}"
           style="display: inline-block; background: linear-gradient(135deg, #e67e22, #f39c12); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
          Reply to ${eName}
        </a>
      </div>
    </div>
    ${emailFooter("<p style=\"color: #6b7280; font-size: 13px; margin: 0 0 16px 0;\">Automated notification from Ace Tours &amp; Transfers.</p>")}
  `);
}

// =============================================================================
// TEST EMAIL
// =============================================================================
export function getTestEmailTemplate(): string {
  const appUrl = process.env.APP_URL || "https://acetours.vu";
  const logoUrl = `${appUrl}/assets/logo.png`;
  const timestamp = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" });

  return emailWrapper(`
    ${emailHeader(logoUrl, "Email Test Successful! ✓", "Your email configuration is working")}
    <div style="padding: 32px 28px;">
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; width: 80px; font-size: 14px;">SMTP</td><td style="padding: 8px 0; color: #059669; font-weight: 600; font-size: 14px;">${process.env.SMTP_HOST || "smtp.gmail.com"}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">From</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${process.env.SMTP_USER || "noreply@acetours.vu"}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Sent</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${timestamp}</td></tr>
        </table>
      </div>
    </div>
    ${emailFooter()}
  `);
}
