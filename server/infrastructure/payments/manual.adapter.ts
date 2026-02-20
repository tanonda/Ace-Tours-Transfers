
import { 
  PaymentGatewayService, 
  PaymentInitiationRequest, 
  PaymentInitiationResponse, 
  PaymentStatus, 
  PaymentStatusRequest, 
  PaymentStatusResponse, 
  WebhookEvent, 
  WebhookResponse 
} from "../../domain/payments/interfaces.js";
import { PaymentGateway } from "../../../shared/schema.js";

/**
 * Manual Payment Adapter
 *
 * Handles offline payment flows: Bank Transfer (manual_transfer) and Cash on Delivery (cash).
 * No redirect URL is produced — the guest is sent straight to the success/confirmation page
 * by the application service. Admin manually reconciles once funds are received.
 *
 * Supported slugs: manual, manual_transfer, bank-transfer, bank, cash
 */
export class ManualAdapter implements PaymentGatewayService {
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    this.gatewayConfig = gatewayConfig;
  }

  private get isCash(): boolean {
    return this.gatewayConfig.slug.toLowerCase().includes('cash');
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const slug = this.gatewayConfig.slug;
    const ref = `${slug}_${Date.now()}_${request.bookingId.slice(0, 8).toUpperCase()}`;

    if (this.isCash) {
      console.log(`[MANUAL:CASH] Payment reference ${ref} created for booking ${request.bookingId}. Guest pays at pickup.`);
    } else {
      console.log(`[MANUAL:BANK_TRANSFER] Payment reference ${ref} created for booking ${request.bookingId}. Awaiting bank transfer.`);
    }

    const message = this.isCash
      ? "Cash on delivery confirmed — guest will pay at the start of the tour or vehicle pickup."
      : "Bank transfer initiated — awaiting guest transfer. Admin will confirm on receipt.";

    return {
      success: true,
      message,
      // No redirectUrl — the application service will redirect to /payment/success directly
      transactionId: ref,
      provider: slug,
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    // Manual payments have no webhooks — reconciliation is done by admin
    console.warn("[MANUAL] Webhook called on manual adapter — not supported.");
    return { success: false, message: "Manual payments do not support webhooks. Use admin reconciliation." };
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    // Manual payments stay pending until an admin marks them confirmed
    return {
      status: PaymentStatus.ManualReviewRequired,
      message: "Awaiting manual verification by admin.",
    };
  }
}
