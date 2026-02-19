// server/domain/payments/factory.ts

import { PaymentGateway } from '../../../shared/schema.js';
import { PaymentGatewayService } from './interfaces.js';

// Import all concrete gateway adapters
import { MastercardGatewayAdapter } from '../../infrastructure/payments/mastercard-gateway.adapter.js';
// LOW-4: StripeAdapter import removed — Stripe not available to Vanuatu merchants
import { GooglePayAdapter } from '../../infrastructure/payments/google-pay.adapter.js';
import { ApplePayAdapter } from '../../infrastructure/payments/apple-pay.adapter.js';
import { PayPalAdapter } from '../../infrastructure/payments/paypal.adapter.js';
import { EWalletAdapter } from '../../infrastructure/payments/ewallet.adapter.js'; // Generic e-wallet
import { WanTokMoneyAdapter } from '../../infrastructure/payments/wantok-money.adapter.js'; // NEW
import { DigicelMobileMoneyAdapter } from '../../infrastructure/payments/digicel-mobile-money.adapter.js'; // NEW
import { KwikPayAdapter } from '../../infrastructure/payments/kwikpay.adapter.js'; // NEW
import { BredBankAdapter } from '../../infrastructure/payments/bred-bank.adapter.js'; // NEW
import { BspBankAdapter } from '../../infrastructure/payments/bsp-bank.adapter.js'; // NEW
import { AnzEGateAdapter } from '../../infrastructure/payments/anz-egate.adapter.js'; // Use specific ANZ eGate adapter, which internally delegates to Mastercard if needed

/**
 * Creates and returns a concrete implementation of PaymentGatewayService
 * based on the provided PaymentGateway configuration.
 *
 * @param gatewayConfig The configuration of the payment gateway from the database.
 * @returns An instance of PaymentGatewayService.
 * @throws Error if the gateway slug is unknown or not yet implemented.
 */
export function getPaymentGatewayService(gatewayConfig: PaymentGateway): PaymentGatewayService {
  switch (gatewayConfig.slug) {
    // Specific Local Bank implementations (potentially delegating internally)
    case 'anz-egate':
      return new AnzEGateAdapter(gatewayConfig); // Use dedicated ANZ adapter
    case 'bred-bank':
      return new BredBankAdapter(gatewayConfig);
    case 'bsp-bank':
      return new BspBankAdapter(gatewayConfig);
    case 'generic-local-bank': // For other local banks using the generic Mastercard Gateway
      return new MastercardGatewayAdapter(gatewayConfig);

    // Local E-wallet implementations
    case 'wantok-money':
      return new WanTokMoneyAdapter(gatewayConfig);
    case 'digicel-mobile-money':
      return new DigicelMobileMoneyAdapter(gatewayConfig);
    case 'kwikpay':
      return new KwikPayAdapter(gatewayConfig);

    // Other specific gateway implementations
    case 'stripe':
      throw new Error('LOW-4: Stripe is not available to Vanuatu merchants. This gateway has been deprecated.');
    case 'google-pay':
      return new GooglePayAdapter(gatewayConfig);
    case 'apple-pay':
      return new ApplePayAdapter(gatewayConfig);
    case 'paypal':
      return new PayPalAdapter(gatewayConfig);
    case 'e-wallet': // This might become redundant if all e-wallets have specific adapters
      return new EWalletAdapter(gatewayConfig);

    default:
      throw new Error(`Unknown or unimplemented payment gateway: ${gatewayConfig.slug}`);
  }
}
