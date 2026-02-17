import { PaymentGateway } from "../../../shared/schema.js";
import { PaymentGatewayService, PaymentStatus } from "../../domain/payments/interfaces.js";
import { StripeAdapter } from "./stripe.adapter.js";
import { ManualAdapter } from "./manual.adapter.js";
import { AnzAdapter } from "./anz.adapter.js";
import { BspAdapter } from "./bsp.adapter.js";
import { BredAdapter } from "./bred.adapter.js";
import { config } from "../../config.js";

export class PaymentFactory {
  private static adapters: Record<string, new (config: PaymentGateway) => PaymentGatewayService> = {
    'manual': ManualAdapter as any,
    'stripe': StripeAdapter,
    'anz': AnzAdapter as any,
    'bsp': BspAdapter as any,
    'bred': BredAdapter as any,
    'anz-egate': AnzAdapter as any,
    'bred-bank': BredAdapter as any,
  };

  static getPaymentGatewayService(gatewayConfig: PaymentGateway): PaymentGatewayService {
    const slug = gatewayConfig.slug.toLowerCase();

    // 1. Check Global Disconnect - Only manual allowed if external systems are off
    const externalDisconnected = config.payments.externalDisconnected;
    const isManual = slug === 'manual' || slug.includes('bank') || slug.includes('cash') || slug.includes('transfer');

    if (externalDisconnected && !isManual) {
      console.warn(`[FACTORY][REJECTED] slug: ${slug} | reason: global_external_disconnect`);
      throw new Error(`External payment gateway ${slug} is currently disabled.`);
    }

    // 2. Resolve Adapter Class
    const AdapterClass = this.adapters[slug];
    if (!AdapterClass) {
      console.error(`[FACTORY][ERROR] slug: ${slug} | reason: adapter_not_implemented`);
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
      console.warn(`[FACTORY][REJECTED] slug: ${slug} | reason: ${reason}`);
      throw new Error(`Payment gateway ${slug} is currently unavailable.`);
    }

    console.log(`[FACTORY][RESOLVED] slug: ${slug} | adapter: ${AdapterClass.name}`);
    return new AdapterClass(gatewayConfig);
  }

  private static normalizeSlugToFlag(slug: string): string {
    if (slug === 'anz-egate') return 'anz';
    if (slug === 'bred-bank') return 'bred';
    return slug;
  }
}
