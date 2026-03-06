import { PaymentGateway } from "../../../shared/schema.js";
import { PaymentGatewayService, PaymentStatus } from "../../domain/payments/interfaces.js";
import { ManualAdapter } from "./manual.adapter.js";
import { AnzEGateAdapter } from "./anz-egate.adapter.js";
import { BspEGateAdapter } from "./bsp-egate.adapter.js";
import { BredEGateAdapter } from "./bred-egate.adapter.js";
import { StripeAdapter } from "./stripe.adapter.js";
import { PayPalAdapter } from "./paypal.adapter.js";
import { WanTokMoneyAdapter } from "./wantok-money.adapter.js";
import { DigicelMobileMoneyAdapter } from "./digicel-mobile-money.adapter.js";
import { KwikPayAdapter } from "./kwikpay.adapter.js";
import { GooglePayAdapter } from "./google-pay.adapter.js";
import { ApplePayAdapter } from "./apple-pay.adapter.js";
import { config } from "../../config.js";
import { createLogger } from "../../lib/logger.js";
import { PaymentMethodClassifier } from "../../domain/payments/payment-method-classifier.js";

const log = createLogger('payment-factory');

export class PaymentFactory {
  private static adapters: Record<string, new (config: PaymentGateway) => PaymentGatewayService> = {
    // Manual / offline payment methods — all routed through ManualAdapter
    'manual': ManualAdapter as any,
    'manual_transfer': ManualAdapter as any,   // Bank transfer (canonical slug in DB)
    'cash': ManualAdapter as any,              // Cash on delivery
    // Local bank gateways (ANZ/BSP/BRED all delegate to MastercardGatewayAdapter for real VPC hash signing)
    'anz': AnzEGateAdapter as any,
    'anz-egate': AnzEGateAdapter as any,
    'bsp': BspEGateAdapter as any,
    'bsp-bank': BspEGateAdapter as any,
    'bred': BredEGateAdapter as any,
    'bred-bank': BredEGateAdapter as any,
    // International / digital (stub implementations — configure credentials before activating)
    'stripe': StripeAdapter as any,
    'paypal': PayPalAdapter as any,
    // Local e-wallets (stub implementations — not yet available via public API)
    'wantok-money': WanTokMoneyAdapter as any,
    'digicel-mobile-money': DigicelMobileMoneyAdapter as any,
    'kwikpay': KwikPayAdapter as any,
    // Digital wallets (rely on underlying processor — stub implementations)
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
    const AdapterClass = this.adapters[slug];
    if (!AdapterClass) {
      log.error('Adapter not implemented', { slug });
      throw new Error(`Payment gateway ${slug} is not implemented.`);
    }

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
    // All manual/offline variants map to the 'manual' config block
    if (slug === 'manual_transfer' || slug === 'cash') return 'manual';
    return slug;
  }
}
