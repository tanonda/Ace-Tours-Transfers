
import Stripe from 'stripe';
import { getUncachableStripeClient, getStripeSync } from '../../stripeClient.js';
import { 
  PaymentGatewayService, 
  PaymentInitiationRequest, 
  PaymentInitiationResponse, 
  PaymentStatus, 
  PaymentStatusRequest, 
  PaymentStatusResponse, 
  WebhookEvent, 
  WebhookResponse 
} from '../../domain/payments/interfaces.js';
import { Payment, PaymentGateway } from '../../../shared/schema.js';

/**
 * Stripe Payment Gateway Adapter.
 * Integrates with Replit Stripe Connector and stripe-replit-sync.
 */
export class StripeAdapter implements PaymentGatewayService {
  private gatewayConfig: PaymentGateway;

  constructor(gatewayConfig: PaymentGateway) {
    this.gatewayConfig = gatewayConfig;
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const stripe = await getUncachableStripeClient();

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: request.customerEmail,
        line_items: [{
          price_data: {
            currency: request.currency.toLowerCase() || 'vuv',
            product_data: {
              name: request.customerName ? `Booking for ${request.customerName}` : 'Tour Booking',
              description: `Booking ID: ${request.bookingId}`,
            },
            unit_amount: request.amount, // already in cents/smallest unit
          },
          quantity: 1,
        }],
        metadata: {
          bookingId: request.bookingId,
          ...request.metadata
        },
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      });

      return {
        success: true,
        redirectUrl: session.url!,
        transactionId: session.id,
      };
    } catch (error: any) {
      console.error('Stripe initiation error:', error);
      return {
        success: false,
        message: error.message,
        failureReason: error.type === 'StripeInvalidRequestError' ? 'invalid_request' : 'system_error'
      };
    }
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResponse> {
    try {
      const sync = await getStripeSync();
      if (!event.signature) {
        throw new Error('Missing stripe-signature');
      }

      // stripe-replit-sync handles validation and returns the event
      const stripeEvent = await sync.processWebhook(event.rawEvent, event.signature);

      let newStatus: PaymentStatus | undefined;
      let bookingId: string | undefined;
      let paymentId: string | undefined;
      let gatewayReference: string | undefined;

      if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object as any;
        bookingId = session.metadata?.bookingId || session.client_reference_id;
        paymentId = session.metadata?.paymentId;
        newStatus = PaymentStatus.Completed;
        gatewayReference = session.payment_intent as string;
      } else if (stripeEvent.type === 'payment_intent.payment_failed') {
        const intent = stripeEvent.data.object as any;
        bookingId = intent.metadata?.bookingId;
        paymentId = intent.metadata?.paymentId;
        newStatus = PaymentStatus.Failed;
      } else if (stripeEvent.type === 'checkout.session.expired') {
        const session = stripeEvent.data.object as any;
        bookingId = session.metadata?.bookingId;
        paymentId = session.metadata?.paymentId;
        newStatus = PaymentStatus.Expired;
      }

      return {
        success: true,
        bookingId,
        paymentId,
        newPaymentStatus: newStatus,
        gatewayReference
      };
    } catch (error: any) {
      console.error('Stripe webhook error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async queryPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    const stripe = await getUncachableStripeClient();
    if (!request.gatewayReference) {
      return { status: PaymentStatus.Pending, message: "No gateway reference" };
    }

    try {
      // Try to retrieve as session first
      const session = await stripe.checkout.sessions.retrieve(request.gatewayReference);
      let status = PaymentStatus.Processing;

      if (session.payment_status === 'paid') {
        status = PaymentStatus.Completed;
      } else if (session.status === 'expired') {
        status = PaymentStatus.Expired;
      } else if (session.status === 'open' && session.payment_status === 'unpaid') {
        status = PaymentStatus.Processing;
      }

      return {
        status,
        gatewayReference: session.id,
        amount: session.amount_total || 0,
        currency: session.currency?.toUpperCase() || 'VUV',
      };
    } catch (error: any) {
      console.error('Stripe status query error:', error);
      return {
        status: PaymentStatus.Failed,
        message: error.message
      };
    }
  }
}
