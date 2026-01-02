# ADR-004: Read-Model Projections (CQRS-lite)

* **Status**: Accepted
* **Date**: 2026-01-02
* **Author**: Antigravity

## Context
The primary database schema is optimized for write-integrity (aggregates). However, administrative reporting, dashboards, and complex UI views require highly performant, pre-aggregated data that the write-side cannot provide without expensive joins or violating encapsulation.

## Decision
Implement a "CQRS-lite" approach using asynchronous Read-Model Projections:
- **Event-Driven**: Projections subscribe only to Domain Events.
- **Disposable**: All projection tables (`booking_summaries`, `revenue_daily`, etc.) must be rebuildable from scratch using an event replay mechanism.
- **Idempotent**: Handlers must satisfy idempotency to allow for re-delivery or replay without data corruption.
- **No Domain Logic**: Transformation is allowed, but business decisions remain strictly in the Write-Side Aggregates.

## Consequences
* **Positive**: Rapid UI performance, isolated reporting load, and ability to "evolve" the schema by replaying history into new projection versions.
* **Negative**: Potential for "eventual consistency" where the UI is slightly behind the authority; increased database storage for duplicated data.

## Invariants Protected
- Decoupling of "Operational Read" from "Transactional Write" ensures that reporting queries never lock or interfere with booking/payment transactions.

## Rejected Alternatives
- **Direct Table Querying**: Rejected due to performance bottlenecks and leaking internal aggregate structures to the UI layer.
- **Synchronous View Updates**: Rejected because it couples the transaction success to the projection success, violating the "Aggregate is sovereignty" rule.
