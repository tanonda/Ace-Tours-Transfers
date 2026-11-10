// shared/gateway-schemas.ts

/**
 * Admin credential/config schemas per payment-gateway slug.
 *
 * One source of truth for three consumers:
 *  - the admin "Configure" dialog (client/src/pages/admin/payments.tsx) renders
 *    its fields from these shapes;
 *  - the admin save handler validates against them before sending;
 *  - the server (PUT /api/admin/payment-gateways/:id) validates the same schemas,
 *    so values typed straight into the API cannot bypass the form.
 */
import { z } from "zod";
import {
  AnzEGateCredentialsSchema,
  ApplePayCredentialsSchema,
  BredBankCredentialsSchema,
  BspBankCredentialsSchema,
  DigicelMobileMoneyCredentialsSchema,
  DigitalWalletConfigSchema,
  GooglePayCredentialsSchema,
  InternationalFallbackConfigSchema,
  KwikPayCredentialsSchema,
  LocalEWalletConfigSchema,
  NbvBankCredentialsSchema,
  PayPalCredentialsSchema,
  StripeConfigSchema,
  StripeCredentialsSchema,
  WanTokCredentialsSchema,
} from "./schema.js";

export interface GatewaySchemaSet {
  credentials?: z.ZodObject<any>;
  config?: z.ZodObject<any>;
}

export const GATEWAY_SCHEMAS: Record<string, GatewaySchemaSet> = {
  "anz-egate": { credentials: AnzEGateCredentialsSchema }, // MPGS Hosted Checkout
  "bsp-bank": { credentials: BspBankCredentialsSchema }, // MPGS Hosted Checkout
  "nbv-bank": { credentials: NbvBankCredentialsSchema }, // MPGS Hosted Checkout
  "bred-bank": { credentials: BredBankCredentialsSchema }, // Lyra PayZen: shop ID, mode, keys, payment URL
  stripe: { credentials: StripeCredentialsSchema, config: StripeConfigSchema },
  "google-pay": { credentials: GooglePayCredentialsSchema, config: DigitalWalletConfigSchema },
  "apple-pay": { credentials: ApplePayCredentialsSchema, config: DigitalWalletConfigSchema },
  paypal: { credentials: PayPalCredentialsSchema, config: InternationalFallbackConfigSchema },
  "wantok-money": { credentials: WanTokCredentialsSchema, config: LocalEWalletConfigSchema },
  "digicel-mobile-money": { credentials: DigicelMobileMoneyCredentialsSchema, config: LocalEWalletConfigSchema },
  kwikpay: { credentials: KwikPayCredentialsSchema, config: LocalEWalletConfigSchema },
  manual_transfer: {},
  cash: {},
};
