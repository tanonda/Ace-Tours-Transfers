import { mailingService } from "../infrastructure/mailing/MailingService.js";
import { escapeHtml } from "./escape-html.js";
import QRCode from "qrcode";
import { emailLocales } from "./email-translations.js";
import crypto from "crypto";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export function getMsg(locale: string = "en", key: string, vars: Record<string, string> = {}): string {
  const messages = emailLocales[locale] || emailLocales['en'];
  let text = messages[key] || emailLocales['en'][key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`{${k}}`, 'g'), v);
  }
  return text;
}

export async function verifyEmailConfig(): Promise<boolean> {
  return mailingService.verify();
}

/** Generate an HMAC-based unsubscribe URL for CAN-SPAM compliance */
export async function getUnsubscribeUrl(email: string): Promise<string> {
  const { config } = await import("../config.js");
  const appUrl = await getAppUrl();
  const token = crypto
    .createHmac("sha256", config.session.secret || "newsletter-unsub")
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
  return `${appUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${token}`;
}

export async function sendEmail({ to, subject, html, replyTo }: EmailOptions): Promise<boolean> {
  try {
    const opts: Record<string, any> = { to, subject, html };
    if (replyTo) opts.replyTo = replyTo;
    await (mailingService as any).sendEmail(opts);
    return true;
  } catch (err) {
    console.error("[MAIL] sendEmail failed:", err);
    return false;
  }
}

/** Send a newsletter email with proper List-Unsubscribe headers (CAN-SPAM) */
export async function sendNewsletterEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const unsubUrl = await getUnsubscribeUrl(to);
    await (mailingService as any).sendEmail({
      to,
      subject,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    return true;
  } catch (err) {
    console.error("[MAIL] sendNewsletterEmail failed:", err);
    return false;
  }
}

export async function sendAdminEmail(subject: string, html: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || "admin@acetours.vu";
  return sendEmail({ to: adminEmail, subject, html });
}

export function shortBookingRef(bookingId: string): string {
  return (bookingId || "")
    .replace(/^book_/i, "")
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();
}

let _cachedAppUrl: string | null = null;
let _cacheExpiry = 0;

async function getAppUrl(): Promise<string> {
  if (_cachedAppUrl && Date.now() < _cacheExpiry) return _cachedAppUrl;
  try {
    const { storage } = await import("../storage.js");
    const setting = await storage.getSiteSetting("app_url");
    const raw = (typeof setting?.value === "string" ? setting.value : "") ||
      process.env.APP_URL || "https://acetours.vu";
    _cachedAppUrl = raw.replace(/\/$/, "");
    _cacheExpiry = Date.now() + 60_000;
    return _cachedAppUrl;
  } catch {
    return process.env.APP_URL || "https://acetours.vu";
  }
}

async function generateQrDataUrl(bookingId: string): Promise<string> {
  try {
    const appUrl = await getAppUrl();
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

function qrBlock(dataUrl: string, shortRef: string, l: string): string {
  if (!dataUrl) return "";
  return `
    <div style="text-align: center; margin: 28px 0; padding: 20px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px;">
      <p style="color: #004165; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">${getMsg(l, 'qrBlockTitle')}</p>
      <img src="${dataUrl}" alt="Booking QR Code" width="140" height="140"
           style="display: block; margin: 0 auto; border: 3px solid #004165; border-radius: 8px; padding: 6px; background: white;" />
      <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0; line-height: 1.5;">
        ${getMsg(l, 'qrBlockText', { ref: shortRef })}
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

function emailFooter(l: string = "en", extra = ""): string {
  const phone = process.env.BUSINESS_PHONE || "+678 7114045";
  const email = process.env.BUSINESS_EMAIL || "info@acetours.vu";
  const whatsapp = process.env.WHATSAPP_NUMBER || "6787114045";
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

function formatPaxSummary(booking: any): string {
  const parts = [];
  if (booking.adultPaxTotal > 0) parts.push(`${booking.adultPaxTotal}`);
  if (booking.childPaxTotal > 0) parts.push(`${booking.childPaxTotal}`);
  if (booking.infantPaxTotal > 0) parts.push(`${booking.infantPaxTotal}`);
  if (parts.length > 0) return escapeHtml(parts.join(', '));
  return escapeHtml(String(booking.guests || 1));
}

function formatTimeSummary(booking: any): string {
  if (booking.startTime && booking.endTime) return escapeHtml(`${booking.startTime} - ${booking.endTime}`);
  if (booking.startTime) return escapeHtml(booking.startTime);
  return "";
}

function bookingDetailsRows(l: string, eTour: string, eDate: string, eGuests: string, eAmount: string, eTime: string = ""): string {
  const timeRow = eTime ? `<tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${getMsg(l, 'labelTime')}</td><td style="padding: 9px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eTime}</td></tr>` : "";
  return `
    <tr><td style="padding: 9px 0; color: #6b7280; width: 130px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${getMsg(l, 'labelTour')}</td><td style="padding: 9px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eTour}</td></tr>
    <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${getMsg(l, 'labelDate')}</td><td style="padding: 9px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eDate}</td></tr>
    ${timeRow}
    <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${getMsg(l, 'labelGuests')}</td><td style="padding: 9px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${eGuests}</td></tr>
    <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px;">${getMsg(l, 'labelTotalAmount')}</td><td style="padding: 9px 0; color: #059669; font-weight: 700; font-size: 16px;">${eAmount}</td></tr>`;
}

function manageBookingBlock(appUrl: string, bookingId: string, shortRef: string, l: string): string {
  return `
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-top: 24px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #0369a1; font-size: 14px;">
        ${getMsg(l, 'manageBookingText', { ref: shortRef })}
      </p>
      <a href="${appUrl}/manage-booking?ref=${bookingId}"
         style="display: inline-block; background: #0369a1; color: white; padding: 10px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
        ${getMsg(l, 'manageBookingBtn')}
      </a>
    </div>`;
}

function emailWrapper(content: string): string {
  return `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">${content}</div>`;
}

function refBadge(eId: string, gradient: string, subtextColor: string, subtext: string): string {
  return `
    <div style="background: ${gradient}; border-radius: 10px; padding: 18px 22px; margin-bottom: 24px; text-align: center;">
      <p style="color: ${subtextColor}; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 6px 0;">ACT-${eId}</p>
      <p style="color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 4px; margin: 0; font-family: 'Courier New', monospace;">ACT-${eId}</p>
      <p style="color: ${subtextColor}; font-size: 11px; margin: 6px 0 0 0; opacity: 0.9;">${subtext}</p>
    </div>`;
}

export async function getBookingRequestTemplate(
  booking: any,
  tour: any,
  paymentMethod?: "offline" | "online" | "bank_transfer" | "cash"
): Promise<string> {
  const l = booking.locale || "en";
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId = escapeHtml(shortBookingRef(booking.id));
  const eName = escapeHtml(booking.customerName);
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eTime = formatTimeSummary(booking);
  const eGuests = formatPaxSummary(booking);
  const eAmount = escapeHtml(booking.amount);

  const qrDataUrl = await generateQrDataUrl(booking.id);

  const isCash = paymentMethod === "cash";
  const isOffline = paymentMethod === "offline" || paymentMethod === "bank_transfer" || isCash;
  const isOnline = paymentMethod === "online";

  const waNumber = process.env.WHATSAPP_NUMBER || "6787114045";
  let paymentBlock = "";

  if (isCash) {
    paymentBlock = `
      <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 16px;">${getMsg(l, 'cashPaymentTitle')}</h3>
        <p style="color: #15803d; font-size: 14px; line-height: 1.7; margin: 0 0 8px 0;">
          ${getMsg(l, 'cashPaymentText1', { amount: eAmount })}
        </p>
        <p style="color: #15803d; font-size: 14px; margin: 0;">${getMsg(l, 'cashPaymentText2')}</p>
      </div>`;
  } else if (isOffline) {
    const bankRows = [
      ["Bank Name", process.env.BANK_NAME || "ANZ Bank (Vanuatu) Ltd"],
      ["Account Name", process.env.BANK_ACCOUNT_NAME || "Ace Tours &amp; Transfers"],
      ["Account Number", process.env.BANK_ACCOUNT_NUMBER || "Contact us for account details"],
      ["Amount", eAmount],
      ["Payment Reference", `ACT-${eId}`],
    ];
    paymentBlock = `
      <div style="background: #eff6ff; border: 2px solid #93c5fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px;">${getMsg(l, 'bankInstructionsTitle')}</h3>
        <p style="color: #1d4ed8; font-size: 14px; line-height: 1.7; margin: 0 0 16px 0;">
          ${getMsg(l, 'bankInstructionsText', { amount: eAmount, ref: eId })}
        </p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; border: 1px solid #bfdbfe;">
          ${bankRows.map(([label, value], i) => `
          <tr>
            <td style="padding: 10px 14px; color: #6b7280; font-size: 13px; width: 140px; border-bottom: 1px solid #e0f2fe;">${label}</td>
            <td style="padding: 10px 14px; color: #111827; font-weight: 600; font-size: 13px; border-bottom: 1px solid #e0f2fe;">${value}</td>
          </tr>`).join("")}
        </table>
        <div style="margin-top: 14px; padding: 12px 14px; background: #f0f9ff; border-radius: 6px;">
          <p style="color: #0369a1; font-size: 12px; font-weight: 700; margin: 0 0 6px 0; text-transform: uppercase;">${getMsg(l, 'bankTransferOptionsTitle')}</p>
          <p style="color: #0369a1; font-size: 12px; margin: 3px 0;">${getMsg(l, 'bankTransferOptionLocal')}</p>
          <p style="color: #0369a1; font-size: 12px; margin: 3px 0;">${getMsg(l, 'bankTransferOptionDirect')}</p>
          <p style="color: #0369a1; font-size: 12px; margin: 3px 0;">${getMsg(l, 'bankTransferOptionSwift')}</p>
        </div>
        <div style="background: #fef9c3; border: 1px solid #fde047; padding: 12px; margin-top: 12px;">
          <p style="color: #854d0e; font-size: 13px; margin: 0;">${getMsg(l, 'bankHoldNote')}</p>
        </div>
        <p style="color: #1d4ed8; font-size: 13px; margin: 16px 0 0 0;">
          ${getMsg(l, 'pleaseNotifyWhatsapp')}
        </p>
      </div>`;
  } else if (isOnline) {
    paymentBlock = `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${appUrl}/payment?bookingId=${booking.id}"
           style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 16px 44px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">
          ${getMsg(l, 'onlinePaymentBtn')}
        </a>
      </div>`;
  }

  const introTextKey = isCash ? 'bookingRequestIntroCash' : isOffline ? 'bookingRequestIntroOffline' : isOnline ? 'bookingRequestIntroOnline' : 'bookingRequestIntroDefault';

  return emailWrapper(`
    ${emailHeader(logoUrl, getMsg(l, 'bookingRequestTitle'), getMsg(l, 'bookingRequestSubtitle'))}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">${getMsg(l, 'greeting', { name: eName })}</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
        ${getMsg(l, 'thankYouChoosing')} ${getMsg(l, introTextKey)}
      </p>

      ${refBadge(eId, "linear-gradient(135deg, #004165, #006699)", "#bfdbfe", getMsg(l, 'keepRefText'))}

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">${getMsg(l, 'bookingDetailsTitle')}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${bookingDetailsRows(l, eTour, eDate, eGuests, eAmount, eTime)}
          <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">${getMsg(l, 'labelStatus')}</td><td style="padding: 9px 0; font-size: 14px; border-top: 1px solid #f3f4f6;"><span style="background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 12px;">${getMsg(l, 'statusPending')}</span></td></tr>
        </table>
      </div>

      ${paymentBlock}
      ${qrBlock(qrDataUrl, eId, l)}
      ${manageBookingBlock(appUrl, booking.id, eId, l)}

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
        ${getMsg(l, 'footerQuestionsText')}
      </p>
    </div>
    ${emailFooter(l)}
  `);
}

export async function getBookingConfirmedTemplate(booking: any, tour: any): Promise<string> {
  const l = booking.locale || "en";
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId = escapeHtml(shortBookingRef(booking.id));
  const eName = escapeHtml(booking.customerName);
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eTime = formatTimeSummary(booking);
  const eGuests = formatPaxSummary(booking);
  const eAmount = escapeHtml(booking.amount);
  const pickupLocation = booking.pickupLocation ? escapeHtml(booking.pickupLocation) : null;
  const notes = booking.notes ? escapeHtml(booking.notes) : null;
  const qrDataUrl = await generateQrDataUrl(booking.id);

  return emailWrapper(`
    ${emailHeader(logoUrl, getMsg(l, 'bookingConfirmedTitle'), getMsg(l, 'bookingConfirmedSubtitle'))}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">${getMsg(l, 'greeting', { name: eName })}</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
        ${getMsg(l, 'bookingConfirmedIntro')}
      </p>

      ${refBadge(eId, "linear-gradient(135deg, #065f46, #059669)", "#a7f3d0", getMsg(l, 'statusTextConfirmed'))}

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">${getMsg(l, 'bookingDetailsTitle')}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${bookingDetailsRows(l, eTour, eDate, eGuests, eAmount, eTime)}
          ${pickupLocation ? `<tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">${getMsg(l, 'labelPickup')}</td><td style="padding: 9px 0; color: #111827; font-size: 14px; border-top: 1px solid #f3f4f6;">${pickupLocation}</td></tr>` : ""}
          ${notes ? `<tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; vertical-align: top; border-top: 1px solid #f3f4f6;">${getMsg(l, 'labelNotes')}</td><td style="padding: 9px 0; color: #111827; font-size: 14px; border-top: 1px solid #f3f4f6;">${notes}</td></tr>` : ""}
          <tr><td style="padding: 9px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">${getMsg(l, 'labelStatus')}</td><td style="padding: 9px 0; font-size: 14px; border-top: 1px solid #f3f4f6;"><span style="background: #d1fae5; color: #065f46; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 12px;">${getMsg(l, 'statusConfirmed')}</span></td></tr>
        </table>
      </div>

      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 18px 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: 700;">${getMsg(l, 'beforeYouGoTitle')}</h3>
        <ul style="color: #78350f; font-size: 13px; line-height: 2; margin: 0; padding-left: 20px;">
          <li>${getMsg(l, 'beforeYouGoLi1')}</li>
          <li>${getMsg(l, 'beforeYouGoLi2', { ref: eId })}</li>
          <li>${getMsg(l, 'beforeYouGoLi3')}</li>
        </ul>
      </div>

      ${qrBlock(qrDataUrl, eId, l)}
      ${manageBookingBlock(appUrl, booking.id, eId, l)}
    </div>
    ${emailFooter(l, `<p style="color: #374151; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">${getMsg(l, 'footerLookForward')}</p>`)}
  `);
}

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

// ADMIN EMAIL - always 'en'
export async function getAdminNewBookingTemplate(booking: any, tour: any): Promise<string> {
  const adminL = 'en';
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId = escapeHtml(shortBookingRef(booking.id));
  const eName = escapeHtml(booking.customerName);
  const eEmail = escapeHtml(booking.customerEmail);
  const ePhone = booking.customerPhone ? escapeHtml(booking.customerPhone) : null;
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eTime = formatTimeSummary(booking);
  const eGuests = formatPaxSummary(booking);
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
          ${bookingDetailsRows(adminL, eTour, eDate, eGuests, eAmount, eTime)}
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
    ${emailFooter(adminL)}
  `);
}

export async function getBookingStatusUpdateTemplate(booking: any, newStatus: string, tour: any): Promise<string> {
  if (newStatus === "confirmed") {
    return getBookingConfirmedTemplate(booking, tour);
  }

  const l = booking.locale || "en";
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId = escapeHtml(shortBookingRef(booking.id));
  const eName = escapeHtml(booking.customerName);
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eTime = formatTimeSummary(booking);
  const eGuests = formatPaxSummary(booking);
  const eAmount = escapeHtml(booking.amount);

  const statusConfig: Record<string, { bg: string; text: string; icon: string; message: string }> = {
    cancelled: { bg: "#fef2f2", text: "#991b1b", icon: "✗", message: getMsg(l, 'statusCancelledMessage') },
    completed: { bg: "#eff6ff", text: "#1e40af", icon: "★", message: getMsg(l, 'statusCompletedMessage') },
    pending: { bg: "#fef3c7", text: "#92400e", icon: "⏳", message: getMsg(l, 'statusPendingMessage') },
  };
  const s = statusConfig[newStatus] || statusConfig.pending;

  return emailWrapper(`
    ${emailHeader(logoUrl, getMsg(l, 'statusUpdateTitle'), getMsg(l, 'statusUpdateSubtitle'))}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">${getMsg(l, 'greeting', { name: eName })}</p>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
        ${getMsg(l, 'statusUpdateIntro', { ref: eId, tour: eTour })}
      </p>

      <div style="background: ${s.bg}; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <p style="color: ${s.text}; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 1px;">
          ${s.icon} ${newStatus.replace(/_/g, " ").toUpperCase()}
        </p>
        <p style="color: ${s.text}; font-size: 13px; margin: 10px 0 0 0; opacity: 0.85;">${s.message}</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">${getMsg(l, 'bookingDetailsTitle')}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${bookingDetailsRows(l, eTour, eDate, eGuests, eAmount, eTime)}
        </table>
      </div>

      ${manageBookingBlock(appUrl, booking.id, eId, l)}
    </div>
    ${emailFooter(l)}
  `);
}

export async function getPaymentConfirmationTemplate(booking: any, payment: any, tour: any): Promise<string> {
  const l = booking.locale || "en";
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eId = escapeHtml(shortBookingRef(booking.id));
  const eName = escapeHtml(booking.customerName);
  const eTour = escapeHtml(tour.title);
  const eDate = escapeHtml(booking.date);
  const eTime = formatTimeSummary(booking);
  const eGuests = formatPaxSummary(booking);
  const eAmount = escapeHtml(booking.amount);
  const ePayRef = escapeHtml(payment.gatewayReference || "N/A");
  const ePayGw = escapeHtml(payment.gatewayId || payment.provider || "");
  const ePayAmt = escapeHtml(String(payment.amount || ""));
  const ePayCurr = escapeHtml(payment.currency || "VUV");

  const qrDataUrl = await generateQrDataUrl(booking.id);

  return emailWrapper(`
    ${emailHeader(logoUrl, getMsg(l, 'paymentConfirmationTitle'), getMsg(l, 'paymentConfirmationSubtitle'))}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">${getMsg(l, 'greeting', { name: eName })}</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
        ${getMsg(l, 'paymentConfirmationIntro')}
      </p>

      ${refBadge(eId, "linear-gradient(135deg, #065f46, #059669)", "#a7f3d0", getMsg(l, 'statusTextConfirmed'))}

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 14px 0; color: #004165; font-size: 15px; font-weight: 700;">${getMsg(l, 'bookingDetailsTitle')}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${bookingDetailsRows(l, eTour, eDate, eGuests, eAmount, eTime)}
        </table>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px 0; color: #166534; font-size: 15px; font-weight: 700;">${getMsg(l, 'paymentReceiptTitle')}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; width: 130px; font-size: 14px; border-bottom: 1px solid #dcfce7;">${getMsg(l, 'labelTransactionId')}</td><td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 13px; font-family: monospace; border-bottom: 1px solid #dcfce7;">${ePayRef}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #dcfce7;">${getMsg(l, 'labelPaymentMethod')}</td><td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px; border-bottom: 1px solid #dcfce7;">${ePayGw}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${getMsg(l, 'labelAmountPaid')}</td><td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 16px;">${ePayAmt} ${ePayCurr}</td></tr>
        </table>
      </div>

      ${qrBlock(qrDataUrl, eId, l)}
      ${manageBookingBlock(appUrl, booking.id, eId, l)}
    </div>
    ${emailFooter(l)}
  `);
}

export async function getWelcomeEmailTemplate(user: { name: string; email: string }, locale: string = "en"): Promise<string> {
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;

  return emailWrapper(`
    ${emailHeader(logoUrl, "Welcome to Ace Tours! 🌴", "Your adventure in Vanuatu begins here")}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">${getMsg(locale, 'hello')} <strong>${escapeHtml(user.name)}</strong>! 👋</p>
      ...
    </div>
  `);
}

export async function getNewsletterConfirmationTemplate(email: string, name?: string, locale: string = "en"): Promise<string> {
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;
  const unsubUrl = await getUnsubscribeUrl(email);

  return emailWrapper(`
    ${emailHeader(logoUrl, getMsg(locale, 'newsletterTitle'), getMsg(locale, 'newsletterSubtitle'))}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">${getMsg(locale, 'greeting', { name: escapeHtml(name || "there") })}</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0 0 24px 0;">
        ${getMsg(locale, 'newsletterIntro')}
      </p>
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #004165; font-size: 15px;">${getMsg(locale, 'newsletterBenefitsTitle')}</h3>
        <ul style="color: #374151; font-size: 14px; line-height: 2.1; padding-left: 20px; margin: 0;">
          ${getMsg(locale, 'newsletterBenefitsText')}
        </ul>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
        Don't want these emails? <a href="${unsubUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
      </p>
    </div>
    ${emailFooter(locale)}
  `);
}

export async function getContactFormTemplate(contact: {
  name: string; email: string; phone?: string; subject?: string; message: string;
}): Promise<string> {
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;

  const eName = escapeHtml(contact.name);
  const eEmail = escapeHtml(contact.email);
  const ePhone = contact.phone ? escapeHtml(contact.phone) : null;
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
    ${emailFooter("en")}
  `);
}

export async function getContactAutoReplyTemplate(contact: any, locale: string = "en"): Promise<string> {
  const appUrl = await getAppUrl();
  const logoUrl = `${appUrl}/assets/logo.png`;

  const firstName = escapeHtml(contact.name).trim().split(" ")[0];

  return emailWrapper(`
    ${emailHeader(logoUrl, getMsg(locale, 'contactReplyTitle'), getMsg(locale, 'contactReplySubtitle'))}
    <div style="padding: 32px 28px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px 0;">${getMsg(locale, 'hello')} ${firstName}! 👋</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0 0 20px 0;">
        ${getMsg(locale, 'contactReplyIntro1')}
      </p>
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 6px 0; font-weight: 600; text-transform: uppercase;">${getMsg(locale, 'contactReplyBoxTitle')}</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0; white-space: pre-wrap;">${escapeHtml(contact.message).slice(0, 500)}${contact.message.length > 500 ? "…" : ""}</p>
      </div>
      <p style="color: #6b7280; font-size: 13px; margin: 0;">
        ${getMsg(locale, 'contactReplyIntro2')}
      </p>
    </div>
    ${emailFooter(locale)}
  `);
}

export async function getTestEmailTemplate(): Promise<string> {
  const appUrl = await getAppUrl();
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
    ${emailFooter("en")}
  `);
}
