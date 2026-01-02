# Contributing to Ace Tours

We maintain a high-integrity codebase. All contributions must respect DDD boundaries and governance policies.

## Logic Assignment Matrix

| Logic Type | Folder | Responsibility |
| :--- | :--- | :--- |
| **Business Invariants** | `server/domain/` | "Is this action legal according to business rules?" |
| **Use Case Orchestration** | `server/application/` | "Who needs to be called to fulfill this user request?" |
| **State Projections** | `server/infrastructure/projections/` | "How do we format this event for the UI?" |
| **Lifecycle/Retries** | `server/application/sagas/` | "What happens if a payment is late?" |
| **Kill Switches** | `server/config.ts` | "Should this feature be disabled right now?" |

## Pull Request Requirements

1.  **Invariant Protection**: Total lack of business logic in application services or projections.
2.  **Event Integrity**: Every state change MUST emit a correlation-aware Domain Event.
3.  **ADR Compliance**: New events, sagas, or architectural shifts REQUIRE an ADR in `docs/adr/`.
4.  **No Backdoors**: Never use "Admin" flags to bypass aggregate invariants.
5.  **Replay Safety**: Projections must be idempotent. Re-running the same event should not duplicate data.
6.  **Pricing Discipline**: Use `PricingService` for all monetary math. Zero math in controllers.

## Rejection Reasons
- ❌ Mutating aggregate state directly in a database query.
- ❌ Calculating VAT or totals outside of `PricingService`.
- ❌ Adding a high-risk initiation without a kill switch check.
- ❌ Missing ADR for a new domain event or saga.
- ❌ Side effects (emails, third-party calls) inside an aggregate or projection.

