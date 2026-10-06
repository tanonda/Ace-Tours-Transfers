import { PaymentGateway } from "../../../shared/schema.js";
import { PaymentGatewayService, PaymentStatus } from "../../domain/payments/interfaces.js";
import { ManualAdapter } from "./manual.adapter.js";
import { MpgsHostedCheckoutAdapter } from "./mpgs.adapter.js";
import { PayzenAdapter } from "./payzen.adapter.js";
import { StripeAdapter } from "./stripe.adapter.js";
import { PayPalAdapter } from "./paypal.adapter.js";
import { WanTokMoneyAdapter } from "./wantok-money.adapter.js";
import { DigicelMobileMoneyAdapter } from "./digicel-mobile-money.adapter.js";
import { KwikPayAdapter } from "./kwikpay.adapter.js";
import { GooglePayAdapter } from "./google-pay.adapter.js";
import { ApplePayAdapter } from "./apple-pay.adapter.js";
import { config, isGatewayEnabledByEnv } from "../../config.js";
import { createLogger } from "../../lib/logger.js";
import { PaymentMethodClassifier } from "../../domain/payments/payment-method-classifier.js";

const log = createLogger('payment-factory');

export class PaymentFactory {
  private static adapters: Record<string, new (config: PaymentGateway) => PaymentGatewayService> = {
    // Manual / offline payment methods — all routed through ManualAdapter
    'manual': ManualAdapter as any,
    'manual_transfer': ManualAdapter as any,   // Bank transfer (canonical slug in DB)
    'cash': ManualAdapter as any,              // Cash on delivery
    // Local bank gateways: ANZ, BSP and NBV use MPGS Hosted Checkout; BRED uses Lyra PayZen
    'anz-egate': MpgsHostedCheckoutAdapter as any,
    'bsp-bank': MpgsHostedCheckoutAdapter as any,
    'nbv-bank': MpgsHostedCheckoutAdapter as any,
    'bred-bank': PayzenAdapter as any,
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

  /**
   * @param use 'new' to start a payment (checkout, payment link); 'existing' to settle one
   * already in progress (bank callbacks, reconciliation). Every switch below blocks new
   * payments only: per docs/KILL_SWITCH_POLICY.md, kill switches block initiation, never
   * resolution, so money a guest has already paid is always confirmed. To stop a gateway's
   * callbacks too, switch the gateway off in admin (callbacks for inactive gateways are ignored).
   */
  static getPaymentGatewayService(gatewayConfig: PaymentGateway, use: 'new' | 'existing' = 'new'): PaymentGatewayService {
    const slug = gatewayConfig.slug.toLowerCase();

    if (!Object.prototype.hasOwnProperty.call(this.adapters, slug)) {
      log.error('Adapter not implemented', { slug });
      throw new Error(`Payment gateway ${slug} is not implemented.`);
    }
    const AdapterClass = this.adapters[slug];

    if (use === 'new') {
      const blockedBy =
        config.killSwitches.paymentsPaused ? 'global_kill_switch'
        : config.payments.externalDisconnected && !PaymentMethodClassifier.isOffline(slug) ? 'global_external_disconnect'
        : config.killSwitches.cardPaymentsPaused && PaymentMethodClassifier.isOnlineCard(slug) ? 'card_kill_switch'
        : !isGatewayEnabledByEnv(slug) ? 'feature_flag_disabled'
        : undefined;
      if (blockedBy) {
        log.warn('[KILL_SWITCH][BLOCKED] New payment refused', { slug, reason: blockedBy });
        throw new Error(`Payment gateway ${slug} is currently unavailable.`);
      }
    }

    log.info('Gateway resolved', { slug, adapter: AdapterClass.name });
    return new AdapterClass(gatewayConfig);
  }
}
