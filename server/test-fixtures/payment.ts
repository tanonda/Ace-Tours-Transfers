import type { Booking, PaymentGateway } from "../../shared/schema.js";

export function makePaymentGateway(overrides: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    id: "gw-123",
    slug: "bred-bank",
    displayName: "BRED Bank",
    description: null,
    active: true,
    isDefault: true,
    priority: 1,
    credentials: {},
    supportedCurrencies: ["VUV"],
    config: {
      supportedCurrencies: ["VUV"],
      defaultDisplayCurrency: "VUV",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeMastercardPaymentGateway(
  overrides: Partial<PaymentGateway> = {},
): PaymentGateway {
  return makePaymentGateway({
    credentials: {
      merchantId: "TESTMERCH",
      accessCode: "TESTACCESS",
      secureHashSecret: "SuperSecret123",
      apiEndpoint: "https://migs.bred.vd/vpcpay",
      version: "1",
    },
    config: {
      terminalId: "T1",
      integrationType: "HOSTED_REDIRECT",
      bankApiEndpointUrl: "https://migs.bred.vd/vpcpay",
      settlementAccountId: "ACC123",
      supportedCurrencies: ["VUV"],
      defaultDisplayCurrency: "VUV",
      enforce3DSecure: true,
      threeDSecureThreshold: 10000,
      callbackWebhookUrl: "https://acetours.com/payment/callback",
      dataPortEndpoint: "https://migs.bred.vd/vpcdps",
    },
    ...overrides,
  });
}

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "book-123",
    userId: "usr-1",
    bookingSessionId: "sess-1",
    idempotencyKey: null,
    tourId: "tour-1",
    tourInstanceId: null,
    holdId: null,
    date: "2026-06-20",
    startTime: null,
    endTime: null,
    guests: 2,
    amount: "25000",
    totalAmountCents: 25000,
    currency: "VUV",
    adultPaxTotal: 2,
    childPaxTotal: 0,
    infantPaxTotal: 0,
    petPaxTotal: 0,
    status: "pending",
    paymentReference: null,
    createdAt: new Date(),
    customerName: "Alice",
    customerEmail: "alice@example.com",
    customerPhone: "12345",
    tourName: "Blue Hole Tour",
    locale: "en",
    pickupLocation: null,
    confirmedAt: null,
    updatedAt: new Date(),
    archivedAt: null,
    notes: null,
    fraudScore: null,
    fraudLevel: null,
    fraudSignals: null,
    fraudReviewedAt: null,
    fraudReviewedBy: null,
    ...overrides,
  };
}
