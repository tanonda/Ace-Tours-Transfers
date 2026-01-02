# ADR-002: Event-Driven Confirmation Flow

* **Status**: Accepted
* **Date**: 2026-01-02
* **Author**: Antigravity

## Context
Direct service-to-service calls caused tight coupling and hidden side effects. Changes in one area (e.g., payments) required immediate, synchronous knowledge in another (e.g., inventory), creating a fragile "big ball of mud".

## Decision
All lifecycle transitions (booking confirmation, payment resolution) occur via domain events dispatched via an `EventDispatcher`. Side effects are handled asynchronously by subscribers.

## Consequences
* **Positive**: Improved observability via correlation IDs, clear causality, and decoupled services.
* **Negative**: Debugging requires following event chains rather than a single stack trace.

## Invariants Protected
- Decoupling of payment success from inventory release (ensures one doesn't block the other).
- Consistent audit trail of state changes.

## Rejected Alternatives
- **Synchronous Service Calls**: Rejected because it creates circular dependencies and makes the system prone to partial failures where one service succeeds but the dependent one fails silently.

## Components Documented
- `CartPriced`
- `BookingCreated`
- `PaymentInitiated`
- `PaymentConfirmed`
- `PaymentFailed`
- `PaymentExpired`
