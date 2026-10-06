import { PaymentGateway } from "../../../shared/schema.js";
import { PaymentGatewayService, PaymentStatus } from "../../domain/payments/interfaces.js";
import { ManualAdapter } from "../../infrastructure/payments/manual.adapter.js";
import { MpgsHostedCheckoutAdapter } from "../../infrastructure/payments/mpgs.adapter.js";
import { BspEGateAdapter } from "../../infrastructure/payments/bsp-egate.adapter.js";
import { PayzenAdapter } from "../../infrastructure/payments/payzen.adapter.js";
import { StripeAdapter } from "../../infrastructure/payments/stripe.adapter.js";
import { PayPalAdapter } from "../../infrastructure/payments/paypal.adapter.js";
import { WanTokMoneyAdapter } from "../../infrastructure/payments/wantok-money.adapter.js";
import { DigicelMobileMoneyAdapter } from "../../infrastructure/payments/digicel-mobile-money.adapter.js";
import { KwikPayAdapter } from "../../infrastructure/payments/kwikpay.adapter.js";
import { GooglePayAdapter } from "../../infrastructure/payments/google-pay.adapter.js";
import { ApplePayAdapter } from "../../infrastructure/payments/apple-pay.adapter.js";
import { config } from "../../config.js";
import { createLogger } from "../../lib/logger.js";
import { PaymentMethodClassifier } from "../../domain/payments/payment-method-classifier.js";

const log = createLogger('payment-factory');

export class PaymentFactory {
  private static adapters: Record<string, new (config: PaymentGateway) => PaymentGatewayService> = {
    // Manual / offline payment methods — all routed through ManualAdapter
    'manual': ManualAdapter as any,
    'manual_transfer': ManualAdapter as any,
    'cash': ManualAdapter as any,
    'bank-transfer': ManualAdapter as any,
    'bank': ManualAdapter as any,
    // Local bank gateways: ANZ/BSP delegate to MastercardGatewayAdapter; BRED uses Lyra PayZen
    'anz': MpgsHostedCheckoutAdapter as any,
    'anz-egate': MpgsHostedCheckoutAdapter as any,
    'bsp': BspEGateAdapter as any,
    'bsp-bank': BspEGateAdapter as any,
    'bred': PayzenAdapter as any,
    'bred-bank': PayzenAdapter as any,
    // International
    'stripe': StripeAdapter as any,
    'paypal': PayPalAdapter as any,
    // Local e-wallets
    'wantok-money': WanTokMoneyAdapter as any,
    'digicel-mobile-money': DigicelMobileMoneyAdapter as any,
    'kwikpay': KwikPayAdapter as any,
    // Digital wallets
    'google-pay': GooglePayAdapter as any,
    'apple-pay': ApplePayAdapter as any,
  };

  static getPaymentGatewayService(gatewayConfig: PaymentGateway): PaymentGatewayService {
    const slug = gatewayConfig.slug.toLowerCase();

    // 1. Check Global Disconnect — only offline methods allowed if external systems are off
    const externalDisconnected = config.payments.externalDisconnected;
    if (externalDisconnected && !PaymentMethodClassifier.isOffline(slug)) {
      log.warn('Gateway rejected', { slug, reason: 'global_external_disconnect' });
      throw new Error(`External payment gateway ${slug} is currently disabled.`);
    }

    // 2. Resolve Adapter Class
    if (!Object.prototype.hasOwnProperty.call(this.adapters, slug)) {
      log.error('Adapter not implemented', { slug });
      throw new Error(`Payment gateway ${slug} is not implemented.`);
    }
    const AdapterClass = this.adapters[slug];

    // 3. Feature Flag Check (Absolute Source of Truth)
    const flagKey = this.normalizeSlugToFlag(slug);
    const gatewaySettings = (config.payments as any)[flagKey];
    const isEnabled = gatewaySettings?.enabled ?? true;

    // 4. Kill Switch Check (Production Circuit Breaker)
    const isCard = slug === 'stripe' || slug.includes('card');
    const cardPaused = config.killSwitches.cardPaymentsPaused;
    const globalPaused = config.killSwitches.paymentsPaused;

    const isPaused = (isCard && cardPaused) || globalPaused;

    if (!isEnabled || isPaused) {
      const reason = !isEnabled ? 'feature_flag_disabled' : (globalPaused ? 'global_kill_switch' : 'card_kill_switch');
      log.warn('Gateway rejected', { slug, reason });
      throw new Error(`Payment gateway ${slug} is currently unavailable.`);
    }

    log.info('Gateway resolved', { slug, adapter: AdapterClass.name });
    return new AdapterClass(gatewayConfig);
  }

  private static normalizeSlugToFlag(slug: string): string {
    if (slug === 'anz-egate') return 'anz';
    if (slug === 'bred-bank') return 'bred';
    if (slug === 'bsp-bank') return 'bsp';
    if (slug === 'manual_transfer' || slug === 'bank-transfer' || slug === 'bank' || slug === 'cash') return 'manual';
    return slug;
  }
}
