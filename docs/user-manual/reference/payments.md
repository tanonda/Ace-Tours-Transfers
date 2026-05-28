---
title: "Reference — Payments Gateways"
roles: [admin, owner]
screen: payments
order: 119
---

# Reference — Payments Gateways

**Path:** Admin → Payments (or Admin → Payment Gateways)

The Payment Gateways screen configures API credentials, merchant details, and activation toggles for online, e-wallet, and manual payment methods.

---

## Gateway Categories

### 1. Online Payment Gateways
- **ANZ eGate, BSP Bank, BRED Bank:** Local Vanuatu bank credit card processing. Requires merchant IDs and API keys.
- **PayPal:** International payments. Requires API Client ID and Secret key.
- **Stripe:** Card payments (currently set to inactive for Vanuatu operations).

### 2. Digital E-Wallets & Mobile Money
- **WanTok Money, Digicel Mobile Money, KwikPay:** Local mobile wallet deposit configurations.
- **Google Pay / Apple Pay:** Digital wallet credentials and settings.

### 3. Offline & Manual Methods
- **Bank Transfer / Manual Transfer:** Offline banking deposits.
- **Cash:** Driver/tour guide cash payments.

---

## Managing Gateways

### Toggling Active Status
Click the toggle switch on a gateway card to immediately activate or deactivate the payment method on the public checkout screen.

### Setting the Default Gateway
Click **Set Default** on any active gateway. The default method is pre-selected for customers on the checkout payment page.

### Configuring Credentials
Click **Configure** on a gateway card to open its credential parameters:
1. Enter your merchant identifiers, secret API tokens, or URL endpoints.
2. Review fields containing passwords or key values (these are hidden automatically for security).
3. Click **Save** to validate credentials. Zod schemas check and report invalid input formats before saving.
