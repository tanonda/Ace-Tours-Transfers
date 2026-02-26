
/**
 * Ace Tours Centralized Configuration & Feature Flags
 * 
 * This file handles environment-backed toggles to control payment capabilities,
 * gateway visibility, and production safety checks.
 */

export interface GatewayConfig {
  enabled: boolean;
  visible: boolean;
  mode: 'sandbox' | 'live';
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL,

  // Session Security
  session: {
    secret: process.env.SESSION_SECRET,
  },

  // Payment Systems
  payments: {
    enabled: process.env.PAYMENTS_ENABLED !== 'false',
    externalDisconnected: process.env.PAYMENTS_EXTERNAL_DISABLED === 'true',
    defaultProvider: process.env.PAYMENTS_DEFAULT_PROVIDER || 'manual',

    // Specific Gateway Configurations
    manual: {
      enabled: process.env.PAYMENTS_MANUAL_ENABLED !== 'false',
      bankTransfer: process.env.MANUAL_PAYMENT_BANK_TRANSFER !== 'false',
      cod: process.env.MANUAL_PAYMENT_CASH_ON_DELIVERY !== 'false',
    },

    stripe: {
      enabled: process.env.PAYMENTS_STRIPE_ENABLED === 'true',
      visible: process.env.PAYMENTS_STRIPE_VISIBLE === 'true',
      mode: (process.env.PAYMENTS_STRIPE_MODE as 'sandbox' | 'live') || 'sandbox',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    } as GatewayConfig & { webhookSecret?: string },

    anz: {
      enabled: process.env.PAYMENTS_ANZ_ENABLED === 'true',
      visible: process.env.PAYMENTS_ANZ_VISIBLE === 'true',
      mode: (process.env.PAYMENTS_ANZ_MODE as 'sandbox' | 'live') || 'sandbox',
    } as GatewayConfig,

    bsp: {
      enabled: process.env.PAYMENTS_BSP_ENABLED === 'true',
      visible: process.env.PAYMENTS_BSP_VISIBLE === 'true',
      mode: (process.env.PAYMENTS_BSP_MODE as 'sandbox' | 'live') || 'sandbox',
    } as GatewayConfig,

    bred: {
      enabled: process.env.PAYMENTS_BRED_ENABLED === 'true',
      visible: process.env.PAYMENTS_BRED_VISIBLE === 'true',
      mode: (process.env.PAYMENTS_BRED_MODE as 'sandbox' | 'live') || 'sandbox',
    } as GatewayConfig,
  },

  // DDD Sharpening Flags
  ddd: {
    sharpeningActive: process.env.DDD_SHARPENING_ACTIVE !== 'false',
    cardPaymentsDisabled: process.env.DDD_DISABLE_CARD !== 'false',
    vatRateOverride: process.env.VAT_RATE ? parseFloat(process.env.VAT_RATE) : (process.env.DDD_VAT_RATE ? parseFloat(process.env.DDD_VAT_RATE) : 0.15), // LOW-5: Prefer VAT_RATE, fall back to DDD_VAT_RATE for compat
  },

  // Production Kill Switches (Circuit Breakers)
  killSwitches: {
    paymentsPaused: process.env.GLOBAL_PAYMENTS_PAUSE === 'true',
    bookingsPaused: process.env.NEW_BOOKINGS_PAUSE === 'true',
    bankTransferPaused: process.env.PAUSE_BANK_TRANSFER === 'true',
    cardPaymentsPaused: process.env.PAUSE_CARD_PAYMENTS === 'true',
  },
  cloudinary: {
    url: process.env.CLOUDINARY_URL,
    enabled: !!process.env.CLOUDINARY_URL,
  },

  // SMS Notifications
  sms: {
    provider: (process.env.SMS_PROVIDER as 'android_gateway' | 'twilio' | 'console') || 'console',
    adminPhone: process.env.SMS_ADMIN_PHONE,
    androidGateway: {
      url: process.env.ANDROID_GATEWAY_URL,
      apiKey: process.env.ANDROID_GATEWAY_API_KEY,
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
    },
  },
};

export function validateConfig() {
  const isProd = config.env === 'production';

  // CORS Guard
  if (isProd && (!config.appUrl || !config.appUrl.startsWith('https://'))) {
    console.error("[CONFIG][ERROR] APP_URL must be a valid https URL in production!");
    process.exit(1);
  }

  // 1. Session Secret
  const secret = config.session.secret;
  if (!secret || secret.length < 32) {
    console.error("[CONFIG][ERROR] SESSION_SECRET is missing or insufficient (min 32 chars)!");
    process.exit(1);
  }


  // 2. Default Provider Implementation Guard
  const validProviders = ['manual', 'stripe', 'anz', 'bsp', 'bred'];
  if (!validProviders.includes(config.payments.defaultProvider)) {
    console.error(`[CONFIG][ERROR] Unsupported default payment provider: ${config.payments.defaultProvider}`);
    process.exit(1);
  }

  // 3. Stripe Key Integrity
  if (config.payments.stripe.enabled && !process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) {
    console.error(`[CONFIG][ERROR] Invalid STRIPE_SECRET_KEY prefix. Must start with 'sk_'.`);
    process.exit(1);
  }

  if (config.payments.stripe.enabled && isProd && !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error(`[CONFIG][ERROR] STRIPE_WEBHOOK_SECRET is required in production!`);
    process.exit(1);
  }

  if (config.payments.stripe.visible && !process.env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_')) {
    console.error(`[CONFIG][ERROR] Invalid STRIPE_PUBLISHABLE_KEY prefix. Must start with 'pk_'.`);
    process.exit(1);
  }

  // 3. Log Performance & Posture
  console.log("--------------------------------------------------");
  console.log(`[POSTURE] Environment: ${config.env.toUpperCase()}`);
  console.log(`[POSTURE] Payments Enabled: ${config.payments.enabled}`);
  console.log(`[POSTURE] External Gateways: ${config.payments.externalDisconnected ? 'DISCONNECTED (Manual Only)' : 'ENABLED'}`);
  console.log(`[POSTURE] Default Provider: ${config.payments.defaultProvider}`);

  const activeGateways = Object.entries(config.payments)
    .filter(([key, val]: [string, any]) => val.enabled && key !== 'enabled' && key !== 'externalDisconnected' && key !== 'defaultProvider')
    .map(([key]) => key);

  const visibleGateways = Object.entries(config.payments)
    .filter(([key, val]: [string, any]) => val.visible && key !== 'enabled' && key !== 'externalDisconnected' && key !== 'defaultProvider')
    .map(([key]) => key);

  console.log(`[POSTURE] Enabled Adapters: ${activeGateways.join(', ') || 'none'}`);
  console.log(`[POSTURE] Visible to Guests: ${visibleGateways.join(', ') || 'manual'}`);
  console.log("--------------------------------------------------");
}
