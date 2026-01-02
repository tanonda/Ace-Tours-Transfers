# How to Add a New Payment Method Safely

Adding a payment method is a high-stakes evolution. Follow this checklist to ensure domain integrity.

## 1. Aggregate Boundary
- Ensure the `PaymentIntent` aggregate can represent the new method's state transitions.
- If the method is radically different, create a new specialized aggregate.

## 2. Event Flow
- Emit specialized events if the lifecycle differs (e.g., `CryptoPaymentReceived`).
- All events must include `paymentId`, `bookingId`, and a `correlationId`.

## 3. Saga Integration
- If the method is asynchronous (like Bank Transfer), add a new Saga or extend the `BankTransferReconciliationSaga`.
- The Saga must handle timeouts and expiry specific to the new method.

## 4. Projection Updates
- Update `PaymentOverviewHandler` to recognize the new method.
- Ensure the `method` field in projections is updated correctly.

## 5. Kill Switch Integration
- Add a granular kill switch (e.g., `PAUSE_METHOD_XYZ`) to the configuration.
- Enforce the switch in the `PaymentApplicationService`.

## Anti-Patterns
- ❌ Do NOT calculate fees or totals in the Payment Service (use `PricingService`).
- ❌ Do NOT trigger booking confirmation directly from a webhook; always go through an aggregate and an event.
- ❌ Do NOT bypass the Saga for "instant" payments; even instant payments need an audit trail.
