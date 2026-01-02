# How to Add a Payment Method (Safe Integration)

Adding a new payment method in Ace Tours & Transfers requires high discipline to maintain the integrity of the booking and payment state machines. Follow these steps meticulously.

## 1. Define the Gateway in Schema
Ensure the payment provider is represented in the database (e.g., via a migration or the `PaymentGateway` table).

## 2. Implement the Adapter
Create a new adapter in `server/infrastructure/payments/adapters/`.
- Must implement `PaymentGatewayService` interface.
- **Rules**:
    - No direct database mutation.
    - No side effects outside the initiation/webhook flow.

## 3. Register in Factory
Add the new adapter to `server/infrastructure/payments/factory.ts`.

## 4. Aggregate Integration
- The `PaymentIntent` aggregate in `server/domain/payments/PaymentIntent.ts` must implicitly or explicitly support the new method.
- Ensure the `PaymentInitiated` event contains the correct provider slug.

## 5. Application Service Guard
In `server/application/payment.application-service.ts`:
- Check for a granular kill switch (e.g., `PAUSE_{PROVIDER_NAME}`).
- Ensure the provider is active before initiation.

## 6. Projection Updates
If the new payment method introduces new data types or reporting requirements:
- Create a new **Projection Handler**.
- Register it in `server/infrastructure/projections/projection-engine.ts`.
- Ensure it is **idempotent**.

## 7. Saga Awareness
If the payment method is asynchronous (like Bank Transfer), ensure the `ReconciliationSaga` is aware of it or create a specific saga.

## 8. Kill Switch Integration
Add a new flag to `server/config.ts` and the `.env` template to allow emergency pausing of this specific method.

## 9. ADR Formalization
Create an ADR in `docs/adr/` describing the new payment method, why it was chosen, and how it protects domain invariants.

## Anti-Patterns to Avoid
- ❌ Mutating `Booking` status directly from the payment webhook (go through the `PaymentIntent` aggregate → Event → Saga).
- ❌ Hardcoding provider keys in the adapter (use `process.env` and `config.ts`).
- ❌ Triggering emails directly from the payment adapter.
