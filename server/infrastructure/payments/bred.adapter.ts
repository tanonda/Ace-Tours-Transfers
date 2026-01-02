
import { 
  HostedBankGatewayAdapter, 
  PaymentInitiationRequest, 
  PaymentInitiationResponse, 
  PaymentStatus, 
  PaymentStatusRequest, 
  PaymentStatusResponse, 
  WebhookEvent, 
  WebhookResponse 
} from "../../domain/payments/interfaces";
import { config } from "../../config";
import { PaymentGateway } from "@shared/schema";

/**
 * BRED Bank Hosted Checkout Adapter (Stub)
 */
export class BredAdapter implements HostedBankGatewayAdapter {
  readonly providerSlug = 'bred';
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    this.gatewayConfig = gatewayConfig;
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse & { redirectUrl?: string; gatewayReference?: string }> {
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

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse & { normalizedStatus?: PaymentStatus }> {
    return { success: true, normalizedStatus: PaymentStatus.Pending };
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    return { status: PaymentStatus.Pending };
  }
}
