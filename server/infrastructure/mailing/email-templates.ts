/**
 * email-templates.ts — Branded HTML email templates for Ace Tours & Transfers
 *
 * Each function returns { subject, html } ready for MailingService.sendEmail().
 * Branding: #f4a830 gold, #0f0d09 dark, #f0ece4 cream.
 */

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

const BRAND_HEADER = `
<div style="background:#0f0d09;padding:24px 32px;text-align:center;border-bottom:3px solid #f4a830">
  <h1 style="color:#f4a830;font-family:Georgia,serif;font-size:28px;margin:0;letter-spacing:1px">
    Ace Tours &amp; Transfers
  </h1>
  <p style="color:#a0998d;font-size:12px;margin:6px 0 0;letter-spacing:2px">VANUATU</p>
</div>
`;

const BRAND_FOOTER = `
<div style="background:#0f0d09;padding:20px 32px;text-align:center;border-top:2px solid #1a1814">
  <p style="color:#a0998d;font-size:12px;margin:0">
    Ace Tours &amp; Transfers Vanuatu &bull; Port Vila, Vanuatu
  </p>
  <p style="color:#706a60;font-size:11px;margin:8px 0 0">
    <a href="mailto:${process.env.BUSINESS_EMAIL || 'info@acetours.vu'}" style="color:#f4a830;text-decoration:none">${process.env.BUSINESS_EMAIL || 'info@acetours.vu'}</a>
    &nbsp;&bull;&nbsp;
    <a href="${process.env.APP_URL || 'https://acetours.vu'}" style="color:#f4a830;text-decoration:none">${(process.env.APP_URL || 'https://acetours.vu').replace(/^https?:\/\//, '')}</a>
  </p>
  <p style="color:#504a40;font-size:10px;margin:12px 0 0">
    &copy; ${new Date().getFullYear()} Ace Tours &amp; Transfers. All prices include 15% VAT where applicable.
  </p>
</div>
`;

function wrap(content: string): string {
  const googlePlaceId = process.env.GOOGLE_PLACE_ID;
  const reviewLink = googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}`
    : (process.env.APP_URL || `https://acetours.vu`);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(reviewLink)}`;

  // We add a subtle review link & QR in the footer area for guest communications
  const reviewSection = `
    <div style="background:#1a1814;padding:24px 32px;text-align:center;border-top:1px solid #2a2720">
      <h4 style="color:#f4a830;margin:0 0 12px;font-size:14px;font-weight:normal;letter-spacing:1px">HAD A GREAT TIME? LEAVE A REVIEW</h4>
      <p style="color:#a0998d;font-size:12px;margin:0 0 16px">Your feedback helps us provide the best experience in Vanuatu.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:280px">
        <tr>
          <td align="center" style="padding-right:12px">
            <img src="${qrCodeUrl}" alt="Review QR Code" width="80" height="80" style="display:block;border-radius:4px;border:2px solid #333" />
          </td>
          <td align="left" valign="middle">
            <a href="${reviewLink}" style="display:inline-block;background:#f4a830;color:#0f0d09;font-weight:bold;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px">Review on Google</a>
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

export function bookingConfirmation(data: BookingTemplateData) {
  const paymentNote = data.paymentMethod === 'Bank Transfer'
    ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0">
         <h3 style="color:#1e40af;margin:0 0 8px;font-size:14px">💳 Bank Transfer Instructions</h3>
         ${data.bankDetails || '<p style="color:#1e3a8a;font-size:13px;margin:0">Transfer details will be provided separately.</p>'}
       </div>`
    : data.paymentMethod === 'Cash'
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0">
         <h3 style="color:#166534;margin:0 0 8px;font-size:14px">💵 Cash Payment</h3>
         <p style="color:#15803d;font-size:13px;margin:0">Please have the exact amount ready at pickup/check-in.</p>
       </div>`
      : '';

  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">Booking Confirmed! ✅</h2>
    <p style="color:#706a60;margin:0 0 24px;font-size:14px">Thank you for booking with us, ${data.customerName}.</p>

    <div style="background:#fafaf8;border:1px solid #e8e4dc;border-radius:8px;padding:20px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:6px 0;color:#706a60;width:40%">Booking Ref</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f0d09">${data.bookingRef}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#706a60">Experience</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f0d09">${data.tourName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#706a60">Date</td>
          <td style="padding:6px 0;color:#0f0d09">${data.date}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#706a60">Guests</td>
          <td style="padding:6px 0;color:#0f0d09">${data.paxSummary}</td>
        </tr>
        <tr style="border-top:1px solid #e8e4dc">
          <td style="padding:12px 0 6px;color:#706a60;font-weight:bold">Total</td>
          <td style="padding:12px 0 6px;font-weight:bold;font-size:18px;color:#f4a830">${data.totalFormatted}</td>
        </tr>
      </table>
    </div>

    ${paymentNote}

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:20px 0">
      <p style="color:#92400e;font-size:12px;margin:0"><strong>Cancellation Policy:</strong> Free cancellation up to 24 hours before your scheduled date. After that, a 50% fee applies.</p>
    </div>

    <p style="color:#706a60;font-size:13px;margin:16px 0 0">We look forward to welcoming you! If you have any questions, reply to this email or WhatsApp us.</p>
  `);

  return {
    subject: `Booking Confirmed — ${data.bookingRef}`,
    html,
  };
}

export function paymentReceipt(data: PaymentTemplateData) {
  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">Payment Received 🎉</h2>
    <p style="color:#706a60;margin:0 0 24px;font-size:14px">Hi ${data.customerName}, your payment has been confirmed.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:6px 0;color:#166534;width:40%">Booking Ref</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f0d09">${data.bookingRef}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#166534">Amount Paid</td>
          <td style="padding:6px 0;font-weight:bold;font-size:18px;color:#166534">${data.amount}</td>
        </tr>
        ${data.transactionId ? `
        <tr>
          <td style="padding:6px 0;color:#166534">Transaction ID</td>
          <td style="padding:6px 0;color:#0f0d09;font-family:monospace;font-size:12px">${data.transactionId}</td>
        </tr>` : ''}
        ${data.method ? `
        <tr>
          <td style="padding:6px 0;color:#166534">Payment Method</td>
          <td style="padding:6px 0;color:#0f0d09">${data.method}</td>
        </tr>` : ''}
      </table>
    </div>

    <p style="color:#706a60;font-size:13px;margin:16px 0 0">This email serves as your receipt. Please keep it for your records.</p>
  `);

  return {
    subject: `Payment Receipt — ${data.bookingRef}`,
    html,
  };
}

export function paymentInstructions(data: BookingTemplateData) {
  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">Payment Instructions 📋</h2>
    <p style="color:#706a60;margin:0 0 24px;font-size:14px">Hi ${data.customerName}, please complete your payment to confirm booking <strong>${data.bookingRef}</strong>.</p>

    <div style="background:#fafaf8;border:1px solid #e8e4dc;border-radius:8px;padding:20px;margin:0 0 20px">
      <p style="margin:0 0 8px;font-weight:bold;color:#0f0d09">${data.tourName}</p>
      <p style="margin:0 0 8px;color:#706a60;font-size:14px">Date: ${data.date} · ${data.paxSummary}</p>
      <p style="margin:0;font-weight:bold;font-size:18px;color:#f4a830">Total: ${data.totalFormatted}</p>
    </div>

    ${data.bankDetails ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0">
      <h3 style="color:#1e40af;margin:0 0 12px;font-size:14px">🏦 Bank Transfer Details</h3>
      ${data.bankDetails}
      <p style="color:#1e3a8a;font-size:12px;margin:12px 0 0"><strong>Important:</strong> Include your booking reference <strong>${data.bookingRef}</strong> in the transfer description.</p>
    </div>` : ''}

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:20px 0">
      <p style="color:#991b1b;font-size:12px;margin:0"><strong>⏰ Deadline:</strong> Please complete payment within 48 hours to avoid automatic cancellation.</p>
    </div>

    <p style="color:#706a60;font-size:13px;margin:16px 0 0">Questions? Reply to this email or WhatsApp us for assistance.</p>
  `);

  return {
    subject: `Payment Required — ${data.bookingRef}`,
    html,
  };
}

export function paymentFailure(data: PaymentTemplateData & { reason?: string }) {
  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">Payment Issue ⚠️</h2>
    <p style="color:#706a60;margin:0 0 24px;font-size:14px">Hi ${data.customerName}, we encountered an issue with your payment.</p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:6px 0;color:#991b1b;width:40%">Booking Ref</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f0d09">${data.bookingRef}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#991b1b">Amount</td>
          <td style="padding:6px 0;color:#0f0d09">${data.amount}</td>
        </tr>
        ${data.reason ? `
        <tr>
          <td style="padding:6px 0;color:#991b1b">Reason</td>
          <td style="padding:6px 0;color:#0f0d09">${data.reason}</td>
        </tr>` : ''}
      </table>
    </div>

    <p style="color:#706a60;font-size:14px;margin:16px 0">Please try again with a different payment method or contact us for assistance.</p>

    <div style="text-align:center;margin:24px 0">
      <a href="${process.env.APP_URL || 'https://acetours.vu'}/payment?bookingId=${data.bookingRef}" style="display:inline-block;background:#f4a830;color:#0f0d09;font-weight:bold;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px">Retry Payment</a>
    </div>
  `);

  return {
    subject: `Payment Failed — Action Required (${data.bookingRef})`,
    html,
  };
}

export function paymentExpiry(data: { customerName: string; bookingRef: string }) {
  const html = wrap(`
    <h2 style="color:#0f0d09;margin:0 0 8px;font-size:22px">Booking Expired ⏰</h2>
    <p style="color:#706a60;margin:0 0 24px;font-size:14px">Hi ${data.customerName}, your booking <strong>${data.bookingRef}</strong> has expired because payment was not received in time.</p>

    <div style="background:#fafaf8;border:1px solid #e8e4dc;border-radius:8px;padding:20px;margin:0 0 20px">
      <p style="margin:0;color:#706a60;font-size:14px">The inventory has been released. If you'd still like to book, please start a new reservation.</p>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="${process.env.APP_URL || 'https://acetours.vu'}" style="display:inline-block;background:#f4a830;color:#0f0d09;font-weight:bold;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px">Browse Experiences</a>
    </div>
  `);

  return {
    subject: `Booking Expired — ${data.bookingRef}`,
    html,
  };
}
