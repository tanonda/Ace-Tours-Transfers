
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
 * BSP Hosted Checkout Adapter (Stub)
 */
export class BspAdapter implements HostedBankGatewayAdapter {
  readonly providerSlug = 'bsp';
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    this.gatewayConfig = gatewayConfig;
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse & { redirectUrl?: string; gatewayReference?: string }> {
    const mode = config.payments.bsp.mode;
    if (mode === 'live' && !process.env.BSP_MERCHANT_ID) {
      throw new Error("[BSP] Merchant ID missing for LIVE environment.");
    }

    console.log(`[BSP][${mode}] Creating hosted checkout session for booking ${request.bookingId}.`);
    
    return {
      success: true,
      redirectUrl: `https://bsp-gateway.example.com/pay?ref=${Date.now()}`,
      gatewayReference: `bsp_ref_${Date.now()}`,
      provider: 'bsp'
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse & { normalizedStatus?: PaymentStatus }> {
    return { success: true, normalizedStatus: PaymentStatus.Pending };
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    return { status: PaymentStatus.Pending };
  }
}
