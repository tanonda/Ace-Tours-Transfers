/**
 * email-templates.ts — Branded HTML email templates for Ace Tours & Transfers
 *
 * Each function returns { subject, html } ready for MailingService.sendEmail().
 * Branding: #f4a830 gold, #0f0d09 dark, #f0ece4 cream.
 */
import { emailTerms } from './email-i18n.js';

type BookingTemplateData = {
  customerName: string;
  bookingRef: string;
  tourName: string;
  date: string;
  paxSummary: string;       // e.g. "2 adults, 1 child"
  totalFormatted: string;   // e.g. "15,000 VT"
  paymentMethod?: string;   // "Bank Transfer" | "Cash" | "Stripe" etc.
  bankDetails?: string;     // HTML for bank transfer instructions
};

type PaymentTemplateData = {
  customerName: string;
  bookingRef: string;
  amount: string;
  transactionId?: string;
  method?: string;
};

const LOGO_URL = 'https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063924/ace-tours-assets/ace_tours_logo_official.jpg';

const BRAND_HEADER = `
<div style="background:#0f0d09;padding:28px 32px 24px;text-align:center;border-bottom:3px solid #f4a830">
  <img src="${LOGO_URL}" alt="Ace Tours & Transfers" width="70" height="70" style="display:block;margin:0 auto 12px;border-radius:50%;border:2px solid #f4a830" />
  <h1 style="color:#f4a830;font-family:Georgia,serif;font-size:26px;margin:0;letter-spacing:1px">
    Ace Tours &amp; Transfers
  </h1>
  <p style="color:#a0998d;font-size:11px;margin:6px 0 0;letter-spacing:3px;text-transform:uppercase">VANUATU</p>
  <p style="color:#706a60;font-size:11px;margin:8px 0 0;font-style:italic">Your Gateway to Vanuatu Adventures</p>
</div>
<div style="height:3px;background:linear-gradient(90deg,#f4a830,#e6c97a,#f4a830)"></div>
`;

const BRAND_FOOTER = `
<div style="background:#0f0d09;padding:24px 32px;text-align:center;border-top:2px solid #1a1814">
  <img src="${LOGO_URL}" alt="Ace Tours" width="40" height="40" style="display:block;margin:0 auto 10px;border-radius:50%;opacity:0.8" />
  <p style="color:#a0998d;font-size:12px;margin:0;font-weight:600">
    Ace Tours &amp; Transfers Vanuatu
  </p>
  <p style="color:#706a60;font-size:11px;margin:4px 0 0">Port Vila, Vanuatu</p>
  <div style="width:60px;height:1px;background:#f4a830;margin:12px auto"></div>
  <p style="color:#706a60;font-size:11px;margin:0">
    <a href="mailto:${process.env.BUSINESS_EMAIL || 'info@acetours.vu'}" style="color:#f4a830;text-decoration:none">${process.env.BUSINESS_EMAIL || 'info@acetours.vu'}</a>
    &nbsp;&bull;&nbsp;
    <a href="${process.env.APP_URL || 'https://acetours.vu'}" style="color:#f4a830;text-decoration:none">${(process.env.APP_URL || 'https://acetours.vu').replace(/^https?:\/\//, '')}</a>
  </p>
  <p style="color:#504a40;font-size:10px;margin:12px 0 0">
    &copy; ${new Date().getFullYear()} Ace Tours &amp; Transfers. All prices include 15% VAT where applicable.
  </p>
</div>
`;

export function wrap(content: string, locale = 'en'): string {
  const t = emailTerms[locale] || emailTerms['en'];
  const googlePlaceId = process.env.GOOGLE_PLACE_ID;
  const reviewLink = googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    : (process.env.APP_URL || `https://acetours.vu`);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(reviewLink)}`;

  // We add a subtle review link & QR in the footer area for guest communications
  const reviewSection = `
    <div style="background:#1a1814;padding:24px 32px;text-align:center;border-top:1px solid #2a2720">
      <h4 style="color:#f4a830;margin:0 0 12px;font-size:14px;font-weight:normal;letter-spacing:1px">${t.reviewTitle}</h4>
      <p style="color:#a0998d;font-size:12px;margin:0 0 16px">${t.reviewSub}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:280px">
        <tr>
          <td align="center" style="padding-right:12px">
            <img src="${qrCodeUrl}" alt="Review QR Code" width="80" height="80" style="display:block;border-radius:4px;border:2px solid #333" />
          </td>
          <td align="left" valign="middle">
            <a href="${reviewLink}" style="display:inline-block;background:#f4a830;color:#0f0d09;font-weight:bold;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px">${t.reviewGoogle}</a>
          </td>
        </tr>
      </table>
    </div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ece4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    ${BRAND_HEADER}
    <div style="padding:32px">
      ${content}
    </div>
    ${reviewSection}
    ${BRAND_FOOTER}
  </div>
</body>
</html>`;
}

export function bookingConfirmation(data: BookingTemplateData, locale = 'en') {
  const t = emailTerms[locale] || emailTerms['en'];
  const paymentNote = data.paymentMethod === 'Bank Transfer'
    ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0">
         <h3 style="color:#1e40af;margin:0 0 8px;font-size:14px">${t.bankTransferInstructions}</h3>
         ${data.bankDetails || `<p style="color:#1e3a8a;font-size:13px;margin:0">${t.transferDetailsSeparate}</p>`}
       </div>`
    : data.paymentMethod === 'Cash'
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0">
         <h3 style="color:#166534;margin:0 0 8px;font-size:14px">${t.cashPayment}</h3>
         <p style="color:#15803d;font-size:13px;margin:0">${t.haveExactAmount}</p>
       </div>`
      : '';

  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">${t.bookingConfirmed}</h2>
    <p style="color:#706a60;margin:0 0 6px;font-size:14px">${t.thanksBooking}, ${data.customerName}!</p>
    <p style="color:#a0998d;margin:0 0 24px;font-size:13px;font-style:italic">${t.adventureAwaits}</p>

    <div style="background:#fafaf8;border:1px solid #e8e4dc;border-radius:8px;padding:20px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:6px 0;color:#706a60;width:40%">${t.bookingRef}</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f0d09">${data.bookingRef}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#706a60">${t.experience}</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f0d09">${data.tourName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#706a60">${t.date}</td>
          <td style="padding:6px 0;color:#0f0d09">${data.date}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#706a60">${t.guests}</td>
          <td style="padding:6px 0;color:#0f0d09">${data.paxSummary}</td>
        </tr>
        <tr style="border-top:1px solid #e8e4dc">
          <td style="padding:12px 0 6px;color:#706a60;font-weight:bold">${t.total}</td>
          <td style="padding:12px 0 6px;font-weight:bold;font-size:18px;color:#f4a830">${data.totalFormatted}</td>
        </tr>
      </table>
    </div>

    ${paymentNote}

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:20px 0">
      <p style="color:#92400e;font-size:12px;margin:0"><strong>${t.cancellationPolicy}</strong> ${t.cancellationDesc}</p>
    </div>

    <p style="color:#706a60;font-size:13px;margin:16px 0 0">${t.questionsReply}</p>
  `, locale);

  return {
    subject: `Booking Confirmed — ${data.bookingRef}`,
    html,
  };
}

export function paymentReceipt(data: PaymentTemplateData, locale = 'en') {
  const t = emailTerms[locale] || emailTerms['en'];
  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">${t.paymentReceivedTitle}</h2>
    <p style="color:#706a60;margin:0 0 6px;font-size:14px">${t.hi} ${data.customerName}, ${t.paymentConfirmed}</p>
    <p style="color:#a0998d;margin:0 0 24px;font-size:13px;font-style:italic">${t.thanksChoosing}</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:6px 0;color:#166534;width:40%">${t.bookingRef}</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f0d09">${data.bookingRef}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#166534">${t.amountPaid}</td>
          <td style="padding:6px 0;font-weight:bold;font-size:18px;color:#166534">${data.amount}</td>
        </tr>
        ${data.transactionId ? `
        <tr>
          <td style="padding:6px 0;color:#166534">${t.transactionId}</td>
          <td style="padding:6px 0;color:#0f0d09;font-family:monospace;font-size:12px">${data.transactionId}</td>
        </tr>` : ''}
        ${data.method ? `
        <tr>
          <td style="padding:6px 0;color:#166534">${t.paymentMethod}</td>
          <td style="padding:6px 0;color:#0f0d09">${data.method}</td>
        </tr>` : ''}
      </table>
    </div>

    <p style="color:#706a60;font-size:13px;margin:16px 0 0">${t.receiptNote}</p>
  `, locale);

  return {
    subject: `Payment Receipt — ${data.bookingRef}`,
    html,
  };
}

export function paymentInstructions(data: BookingTemplateData, locale = 'en') {
  const t = emailTerms[locale] || emailTerms['en'];
  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">${t.paymentInstructionsTitle}</h2>
    <p style="color:#706a60;margin:0 0 24px;font-size:14px">${t.hi} ${data.customerName}, ${t.completePayment} <strong>${data.bookingRef}</strong>.</p>

    <div style="background:#fafaf8;border:1px solid #e8e4dc;border-radius:8px;padding:20px;margin:0 0 20px">
      <p style="margin:0 0 8px;font-weight:bold;color:#0f0d09">${data.tourName}</p>
      <p style="margin:0 0 8px;color:#706a60;font-size:14px">${t.date}: ${data.date} · ${data.paxSummary}</p>
      <p style="margin:0;font-weight:bold;font-size:18px;color:#f4a830">${t.total}: ${data.totalFormatted}</p>
    </div>

    ${data.bankDetails ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0">
      <h3 style="color:#1e40af;margin:0 0 12px;font-size:14px">${t.bankTransferDetails}</h3>
      ${data.bankDetails}
      <p style="color:#1e3a8a;font-size:12px;margin:12px 0 0"><strong>${t.importantNote}</strong> ${t.includeRefParams} <strong>${data.bookingRef}</strong> ${t.inTransferDesc}</p>
    </div>` : ''}

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:20px 0">
      <p style="color:#991b1b;font-size:12px;margin:0"><strong>${t.deadline}</strong> ${t.completePayment48h}</p>
    </div>

    <p style="color:#706a60;font-size:13px;margin:16px 0 0">${t.questionsAssist}</p>
  `, locale);

  return {
    subject: `Payment Required — ${data.bookingRef}`,
    html,
  };
}

export function paymentFailure(data: PaymentTemplateData & { reason?: string }, locale = 'en') {
  const t = emailTerms[locale] || emailTerms['en'];
  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">${t.paymentIssueTitle}</h2>
    <p style="color:#706a60;margin:0 0 24px;font-size:14px">${t.hi} ${data.customerName}, ${t.issueEncountered}</p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:6px 0;color:#991b1b;width:40%">${t.bookingRef}</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f0d09">${data.bookingRef}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#991b1b">${t.amount}</td>
          <td style="padding:6px 0;color:#0f0d09">${data.amount}</td>
        </tr>
        ${data.reason ? `
        <tr>
          <td style="padding:6px 0;color:#991b1b">${t.reason}</td>
          <td style="padding:6px 0;color:#0f0d09">${data.reason}</td>
        </tr>` : ''}
      </table>
    </div>

    <p style="color:#706a60;font-size:14px;margin:16px 0">${t.tryAgainContact}</p>

    <div style="text-align:center;margin:24px 0">
      <a href="${process.env.APP_URL || 'https://acetours.vu'}/payment?bookingId=${data.bookingRef}" style="display:inline-block;background:#f4a830;color:#0f0d09;font-weight:bold;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px">${t.retryPaymentBtn}</a>
    </div>
  `, locale);

  return {
    subject: `Payment Failed — Action Required (${data.bookingRef})`,
    html,
  };
}

export function paymentExpiry(data: { customerName: string; bookingRef: string }, locale = 'en') {
  const t = emailTerms[locale] || emailTerms['en'];
  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">${t.bookingExpiredTitle}</h2>
    <p style="color:#706a60;margin:0 0 24px;font-size:14px">${t.hi} ${data.customerName}, ${t.yourBooking} <strong>${data.bookingRef}</strong> ${t.bookingExpiredDesc}</p>

    <div style="background:#fafaf8;border:1px solid #e8e4dc;border-radius:8px;padding:20px;margin:0 0 20px">
      <p style="margin:0;color:#706a60;font-size:14px">${t.inventoryReleased}</p>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="${process.env.APP_URL || 'https://acetours.vu'}" style="display:inline-block;background:#f4a830;color:#0f0d09;font-weight:bold;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px">${t.browseExperiences}</a>
    </div>
  `, locale);

  return {
    subject: `Booking Expired — ${data.bookingRef}`,
    html,
  };
}
