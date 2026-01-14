import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Gmail SMTP Configuration
const gmailConfig = {
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
};

// Create reusable transporter object using Gmail SMTP
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport(gmailConfig);
  }
  return transporter;
}

// Verify email configuration on startup
export async function verifyEmailConfig(): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log("⚠️  Email config: Missing GMAIL_USER or GMAIL_APP_PASSWORD. Emails will be simulated.");
    return false;
  }

  try {
    await getTransporter().verify();
    console.log("✅ Email config: Gmail SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("❌ Email config: Gmail SMTP verification failed:", error);
    return false;
  }
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: EmailOptions): Promise<boolean> {
  const fromAddress = process.env.GMAIL_USER || "noreply@acetours.vu";
  const fromName = "Ace Tours & Transfers";

  // Simulate if credentials are missing
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log("📧 Email simulation:", { to, subject, from: fromAddress });
    console.log("   (Configure GMAIL_USER and GMAIL_APP_PASSWORD in .env to send real emails)");
    return true;
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html,
      replyTo: replyTo || fromAddress,
    });

    console.log("📧 Email sent successfully:", {
      messageId: info.messageId,
      to,
      subject,
    });
    return true;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
}

// Send email to admin
export async function sendAdminEmail(subject: string, html: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER || "admin@acetours.vu";
  return sendEmail({ to: adminEmail, subject, html });
}

// ============================================
// EMAIL TEMPLATES
// ============================================

export function getBookingConfirmationTemplate(booking: any, tour: any, payment?: any): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

  const paymentDetails = payment ? `
    <div style="background: #eef2ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4f46e5;">
      <h3 style="margin: 0 0 15px 0; color: #4f46e5; font-size: 16px;">💳 Payment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 120px;">Payment Status:</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600;">${payment.status.toUpperCase()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Transaction ID:</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600;">${payment.gatewayReference || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600;">${payment.gatewayId}</td>
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
        <p style="color: #374151; font-size: 16px;">Dear <strong>${booking.customerName}</strong>,</p>
        <p style="color: #6b7280; line-height: 1.6;">Thank you for choosing Ace Tours & Transfers! Your booking details are below:</p>
        
        <!-- Booking Details Card -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📋 Booking Reference: <span style="color:#e67e22;">${booking.id.slice(0, 8).toUpperCase()}</span></h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Tour Name:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${tour.title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${booking.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Guests:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${booking.guests}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 18px;">${booking.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Status:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-transform: capitalize;">${booking.status}</td>
            </tr>
          </table>
        </div>

        ${paymentDetails}
        ${payNowButton}

        <p style="color: #6b7280; line-height: 1.6;">You can view and manage your booking anytime by visiting your dashboard on our website: <a href="${appUrl}/reservations" style="color: #006699; text-decoration: none;">${appUrl}/reservations</a></p>
        
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
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5XXXXXX<br>
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
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📋 Booking Reference: <span style="color:#e67e22;">${booking.id.slice(0, 8).toUpperCase()}</span></h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Customer:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${booking.customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Tour:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${tour.title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; color: #111827;">${booking.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Guests:</td>
              <td style="padding: 8px 0; color: #111827;">${booking.guests}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700;">${booking.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Status:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-transform: capitalize;">${booking.status}</td>
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
          📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5XXXXXX<br>
          Port Vila, Vanuatu
        </p>
      </div>
    </div>
  `;
}

export function getPaymentConfirmationTemplate(booking: any, payment: any, tour: any): string {
  const appUrl = process.env.APP_URL || 'https://acetours.vu';
  const logoUrl = `${appUrl}/assets/logo.png`;

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
        <p style="color: #374151; font-size: 16px;">Dear <strong>${booking.customerName}</strong>,</p>
        <p style="color: #6b7280; line-height: 1.6;">Your payment for booking <span style="font-weight: 600;">#${booking.id.slice(0, 8).toUpperCase()}</span> has been successfully processed.</p>
        
        <!-- Booking Details Card -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📋 Booking Reference: <span style="color:#e67e22;">${booking.id.slice(0, 8).toUpperCase()}</span></h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Tour Name:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${tour.title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${booking.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Guests:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${booking.guests}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 18px;">${booking.amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Status:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600; text-transform: capitalize;">${booking.status}</td>
            </tr>
          </table>
        </div>

        <!-- Payment Details -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">💳 Payment Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Payment Status:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${payment.status.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Transaction ID:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${payment.gatewayReference || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${payment.gatewayId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Amount Paid:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700;">${payment.amount / 100} ${payment.currency}</td>
            </tr>
          </table>
        </div>

        <p style="color: #6b7280; line-height: 1.6;">You can view and manage your booking anytime by visiting your dashboard on our website: <a href="${appUrl}/reservations" style="color: #006699; text-decoration: none;">${appUrl}/reservations</a></p>
        
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
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5XXXXXX<br>
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

  const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    confirmed: { bg: "#ecfdf5", text: "#059669", icon: "✓" },
    cancelled: { bg: "#fef2f2", text: "#dc2626", icon: "✗" },
    completed: { bg: "#eff6ff", text: "#2563eb", icon: "★" },
    pending: { bg: "#fef3c7", text: "#d97706", icon: "⏳" },
    "pending_payment": { bg: "#fef3c7", text: "#d97706", icon: "⏳" }, // Added pending_payment
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
        <p style="color: #374151; font-size: 16px;">Dear <strong>${booking.customerName}</strong>,</p>
        <p style="color: #6b7280; line-height: 1.6;">The status of your booking <span style="font-weight: 600;">#${booking.id.slice(0, 8).toUpperCase()}</span> for <strong>${tour.title}</strong> has been updated to:</p>
        
        <!-- Status Badge -->
        <div style="text-align: center; margin: 25px 0;">
          <div style="background: ${statusInfo.bg}; display: inline-block; padding: 15px 40px; border-radius: 50px;">
            <span style="color: ${statusInfo.text}; font-size: 20px; font-weight: 700;">
              ${statusInfo.icon} ${newStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <!-- Booking Details -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 15px 0; color: #004165; font-size: 18px;">📋 Booking Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Tour Name:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${tour.title}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${booking.date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Guests:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${booking.guests}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; font-size: 18px;">${booking.amount}</td>
            </tr>
          </table>
        </div>

        <p style="color: #6b7280; line-height: 1.6;">You can view and manage your booking anytime by visiting your dashboard on our website: <a href="${appUrl}/reservations" style="color: #006699; text-decoration: none;">${appUrl}/reservations</a></p>
        
        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #374151; margin: 0;">If you have any questions, please contact us.<br><strong>The Ace Tours Team</strong></p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5XXXXXX<br>
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
        <p style="color: #374151; font-size: 18px;">Hello <strong>${user.name}</strong>! 👋</p>
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
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5XXXXXX<br>
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
  const displayName = name || "there";

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
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5XXXXXX<br>
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
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${contact.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${contact.email}" style="color: #006699;">${contact.email}</a></td>
            </tr>
            ${contact.phone ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Phone:</td>
              <td style="padding: 8px 0; color: #111827;">${contact.phone}</td>
            </tr>
            ` : ''}
            ${contact.subject ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Subject:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${contact.subject}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <!-- Message -->
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 10px 0; color: #004165;">Message:</h3>
          <p style="color: #4b5563; line-height: 1.6; margin: 0; white-space: pre-wrap;">${contact.message}</p>
        </div>

        <!-- Action -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:${contact.email}?subject=Re: ${contact.subject || 'Your Inquiry'}" 
             style="background: linear-gradient(135deg, #e67e22 0%, #f39c12 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
            Reply to ${contact.name}
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; margin: 0; font-size: 14px;">This is an automated notification from Ace Tours & Transfers.</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 15px;">
          📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5XXXXXX<br>
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
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${process.env.GMAIL_USER || 'noreply@acetours.vu'}</td>
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
            📧 <a href="mailto:info@acetours.vu" style="color: #9ca3af; text-decoration: none;">info@acetours.vu</a> | 📞 +678 5XXXXXX<br>
            Port Vila, Vanuatu
          </p>
        </div>
      </div>
    </div>
  `;
}
