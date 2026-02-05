
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
 * Handles non-electronic payment flows like Bank Transfer and Cash on Delivery.
 * Does not redirect; simply transitions payment to 'pending' and assumes 
 * manual reconciliation.
 */
export class ManualAdapter implements PaymentGatewayService {
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    this.gatewayConfig = gatewayConfig;
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log(`[MANUAL] Initiating manual payment (${request.provider}) for booking ${request.bookingId}.`);
    
    const message = request.provider === 'cash' 
      ? "Cash on delivery - customer will pay at pickup/start of service." 
      : "Bank transfer initiated - awaiting customer transfer.";

    return {
      success: true,
      message,
      // No redirect URL for manual payments
      transactionId: `manual_${Date.now()}_${request.bookingId.slice(0, 8)}`,
      provider: request.provider
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    console.warn("[MANUAL] Manual adapter does not support webhooks.");
    return { success: false, message: "Manual payments do not support webhooks." };
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    // Manual payments remain pending until admin intervention.
    return {
      status: PaymentStatus.Pending,
      message: "Awaiting manual verification."
    };
  }
}
