# ADR-003: Manual Bank Transfer First

* **Status**: Accepted
* **Date**: 2026-01-02
* **Author**: Antigravity

## Context
Card payments are not immediately available for local operations in Vanuatu, but future support is required. We need a way to support bookings today while allowing for "plug-and-play" card integration later.

## Decision
Payment method abstraction is implemented now; card providers and other online gateways are disabled via feature flags. The system prioritizes manual bank transfer reconciliation as the primary flow, driven by a Reconciliation Saga.

## Consequences
* **Positive**: No future refactor required for card integration; clear operational flow for admins.
* **Negative**: Higher operational overhead for manual verification of transfers.

## Invariants Protected
- Protection against unauthorized booking confirmation (requires a logged payment proof).
- Isolation of payment provider logic from the core booking domain.

## Rejected Alternatives
- **Wait for Card Integration**: Rejected because the business needs to go live with manual transfers immediately.
- **Hardcoded Bank Transfer Logic**: Rejected because it would make adding Stripe/Card payments later extremely expensive.

## Components Documented
- `BankTransferReconciliationSaga`
