# ADR-006: Introduce 'HoldReleased' Domain Event

* **Status**: Accepted
* **Date**: 2026-02-05
* **Author**: Antigravity

## Context
The availability system handles short-term reservations ("holds") that expire or can be manually released. Subsystems such as analytics, secondary projections, and potentially notification services need to be aware of these releases to maintain consistent state or trigger follow-up actions. Direct coupling between the `AvailabilityService` and these subsystems would violate our DDD principles (ADR-001) and event-driven architecture (ADR-002).

## Decision
Introduce the `HoldReleased` domain event.
- This event is dispatched whenever an `AvailabilityHold` transitions to a `RELEASED` or `EXPIRED` status.
- It contains the `holdId` and the `reason` for the release.

## Consequences
* **Positive**: 
    - Decouples `AvailabilityService` from side-effect handlers.
    - Enables accurate real-time projections of available capacity.
    - Provides a clear audit trail for why inventory was returned to the pool.
* **Negative**: 
    - Slight increase in system complexity due to the asynchronous nature of event handling.

## Invariants Protected
- Decoupling of inventory management from reporting/analytics.
- Ensures that the reason for inventory return is captured and can be reacted upon consistently across the system.

## Rejected Alternatives
- **Direct Service Calls**: Rejected as per ADR-002 to avoid tight coupling.
- **Polling for Status Changes**: Rejected as inefficient and leads to latency in read-model updates.

## Components Documented
- `HoldReleased`
