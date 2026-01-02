# ADR-001: Domain-Driven Design Enforcement

* **Status**: Accepted
* **Date**: 2026-01-02
* **Author**: Antigravity

## Context
Ace Tours & Transfers handles bookings, pricing, and payments where correctness outweighs convenience. Early implementations risked duplicated logic, pricing drift, and unsafe payment transitions.

## Decision
The system adopts strict Domain-Driven Design principles:
- **Aggregates enforce invariants**: State cannot be changed without satisfying domain rules.
- **State transitions are explicit**: Use status field with validation in the application layer.
- **Pricing is centralized**: `PricingService` is the single source of truth for all monetary math.
- **Payments are event-driven**: Confirmation flow is decoupled via domain events.
- **Read models are projections**: Views (read models) are derived/projected from events, not authoritative.

## Consequences
* **Positive**: Reduced long-term defects, easier auditing, and clear causality.
* **Negative**: Increased upfront discipline and slower velocity for "quick hacks".

## Invariants Protected
- Atomic inventory/capacity management.
- Immutable pricing once a checkout is initiated.
- One-way state transitions for bookings (e.g., cannot confirm a cancelled booking).

## Rejected Alternatives
- **CRUD-only approach**: Rejected because it leads to "anemic domain models" where business rules are scattered across controllers and frontend, making the system fragile.
