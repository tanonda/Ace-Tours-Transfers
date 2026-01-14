
import { 
  HostedBankGatewayAdapter, 
  PaymentInitiationRequest, 
  PaymentInitiationResponse, 
  PaymentStatus, 
  PaymentStatusRequest, 
  PaymentStatusResponse, 
  WebhookEvent, 
  WebhookResponse 
} from "../../domain/payments/interfaces.js";
import { config } from "../../config.js";
import { PaymentGateway } from "../../../shared/schema.js";

/**
 * BRED Bank Hosted Checkout Adapter (Stub)
 */
export class BredAdapter implements HostedBankGatewayAdapter {
  readonly providerSlug = 'bred';
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    this.gatewayConfig = gatewayConfig;
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse & { success: boolean; redirectUrl?: string; gatewayReference?: string }> {
    const mode = config.payments.bred.mode;
    if (mode === 'live' && !process.env.BRED_MERCHANT_ID) {
      throw new Error("[BRED] Merchant ID missing for LIVE environment.");
    }

    console.log(`[BRED][${mode}] Creating hosted checkout session for booking ${request.bookingId}.`);
    
    return {
      success: true,
      redirectUrl: `https://bred-gateway.example.com/checkout?id=${Date.now()}`,
      gatewayReference: `bred_ref_${Date.now()}`,
      provider: 'bred'
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse & { normalizedStatus?: 'completed' | 'failed' | 'cancelled' | 'expired'; gatewayReference?: string; failureReason?: string }> {
    return { success: true, normalizedStatus: 'completed' as const };
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    return { status: PaymentStatus.Pending };
  }
}
