import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { db } from './db';
import { payments, paymentGateways, bookings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { Booking, Payment, PaymentGateway } from '@shared/schema';

export type PaymentProvider = 'stripe' | 'anz-egate' | 'bred-bank' | 'bsp';

export interface PaymentIntent {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  clientSecret?: string;
  checkoutUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export interface CheckoutOptions {
  bookingId: string;
  amount: number;
  currency?: string;
  customerEmail: string;
  customerName: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  provider?: PaymentProvider;
}

class PaymentService {
  async getActiveGateways(): Promise<PaymentGateway[]> {
    return await db.select().from(paymentGateways).where(eq(paymentGateways.active, true));
  }

  async getDefaultGateway(): Promise<PaymentGateway | null> {
    const [gateway] = await db.select()
      .from(paymentGateways)
      .where(eq(paymentGateways.isDefault, true));
    return gateway || null;
  }

  async getStripePublishableKey(): Promise<string> {
    return await getStripePublishableKey();
  }

  async createCheckoutSession(options: CheckoutOptions): Promise<PaymentIntent> {
    const provider = options.provider || 'stripe';
    const currency = options.currency || (provider === 'stripe' ? 'USD' : 'VUV');

    const gatewayRecord = await this.getOrCreateGateway(provider);
    
    const [payment] = await db.insert(payments).values({
      bookingId: options.bookingId,
      gatewayId: gatewayRecord.id,
      amount: Math.round(options.amount * 100),
      currency,
      status: 'pending',
    }).returning();

    if (provider === 'stripe') {
      return await this.createStripeCheckout({ ...options, currency }, payment.id);
    } else {
      return await this.createBankGatewayIntent({ ...options, currency }, payment.id, provider);
    }
  }

  private async createStripeCheckout(options: CheckoutOptions, paymentId: string): Promise<PaymentIntent> {
    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: options.customerEmail,
      line_items: [{
        price_data: {
          currency: options.currency || 'usd',
          product_data: {
            name: options.description,
          },
          unit_amount: Math.round(options.amount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        bookingId: options.bookingId,
        paymentId: paymentId,
      },
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
    });

    await db.update(payments)
      .set({ gatewayReference: session.id })
      .where(eq(payments.id, paymentId));

    return {
      id: paymentId,
      bookingId: options.bookingId,
      amount: options.amount,
      currency: options.currency || 'USD',
      provider: 'stripe',
      checkoutUrl: session.url!,
      status: 'pending',
    };
  }

  private async createBankGatewayIntent(
    options: CheckoutOptions, 
    paymentId: string, 
    provider: PaymentProvider
  ): Promise<PaymentIntent> {
    return {
      id: paymentId,
      bookingId: options.bookingId,
      amount: options.amount,
      currency: options.currency!,
      provider,
      checkoutUrl: `/payment/bank/${provider}/${paymentId}`,
      status: 'pending',
    };
  }

  async getPaymentStatus(paymentId: string): Promise<Payment | null> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    return payment || null;
  }

  async getBookingPayments(bookingId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.bookingId, bookingId));
  }

  private async getOrCreateGateway(provider: PaymentProvider): Promise<PaymentGateway> {
    const slug = provider === 'stripe' ? 'stripe' : provider;
    
    const [existing] = await db.select()
      .from(paymentGateways)
      .where(eq(paymentGateways.slug, slug));
    
    if (existing) return existing;

    const gatewayConfig: Record<PaymentProvider, { displayName: string; description: string; currencies: string[] }> = {
      'stripe': { displayName: 'Stripe', description: 'International card payments via Stripe', currencies: ['USD', 'AUD', 'VUV', 'EUR'] },
      'anz-egate': { displayName: 'ANZ eGate', description: 'ANZ Bank Vanuatu', currencies: ['VUV', 'USD'] },
      'bred-bank': { displayName: 'BRED Bank', description: 'BRED Bank Vanuatu', currencies: ['VUV'] },
      'bsp': { displayName: 'BSP', description: 'Bank of South Pacific', currencies: ['VUV', 'PGK'] },
    };

    const config = gatewayConfig[provider];

    const [gateway] = await db.insert(paymentGateways).values({
      slug,
      displayName: config.displayName,
      description: config.description,
      active: provider === 'stripe',
      isDefault: provider === 'stripe',
      supportedCurrencies: config.currencies,
    }).returning();

    return gateway;
  }
}

export const paymentService = new PaymentService();
