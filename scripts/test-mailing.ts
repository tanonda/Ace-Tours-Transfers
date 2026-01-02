import "dotenv/config";
import { mailingService } from "../server/infrastructure/mailing/MailingService";

async function testMailing() {
  console.log("Starting Mailing Test...");
  
  const testBooking = {
    id: "TEST-BK-001",
    customerName: "Test User",
    tourName: "Vanuatu Adventure",
    date: "2026-06-01",
    amount: "$150.00"
  };

  const recipient = process.env.TEST_EMAIL_RECIPIENT || "test@example.com";
  
  console.log(`Attempting to send test email to ${recipient}...`);
  await mailingService.sendBookingConfirmation(recipient, testBooking);
  
  console.log("Test finished. Check logs for results.");
}

testMailing().catch(console.error);
