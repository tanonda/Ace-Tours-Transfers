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
    
    // 1. Check Global Disconnect
    if (config.payments.externalDisconnected && slug !== 'manual') {
      console.warn(`[FACTORY] External payments are globally disabled. Rejecting ${slug}.`);
      throw new Error(`External payment gateway ${slug} is currently disabled.`);
    }

    // 2. Resolve Adapter Class
    const AdapterClass = this.adapters[slug];
    if (!AdapterClass) {
      throw new Error(`Payment gateway ${slug} is not implemented.`);
    }

    // 3. Feature Flag Check
    const flagKey = this.normalizeSlugToFlag(slug);
    const isEnabled = (config.payments as any)[flagKey]?.enabled ?? true;

    if (!isEnabled) {
      console.error(`[FACTORY] Gateway ${slug} is disabled via feature flag.`);
      throw new Error(`Payment gateway ${slug} is not active in this environment.`);
    }

    return new AdapterClass(gatewayConfig);
  }

  private static normalizeSlugToFlag(slug: string): string {
    if (slug === 'anz-egate') return 'anz';
    if (slug === 'bred-bank') return 'bred';
    return slug;
  }
}
