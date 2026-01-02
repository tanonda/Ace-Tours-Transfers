# ADR-005: Production Kill Switches

* **Status**: Accepted
* **Date**: 2026-01-02
* **Author**: Antigravity

## Context
Production systems require "emergency breaks" to mitigate unforeseen bugs, security breaches, or external availability issues (e.g., Stripe outage). These must be fast to deploy and highly reliable.

## Decision
Implement global and granular "Kill Switches" (Circuit Breakers):
- **Env-Driven**: Switches are controlled via Environment Variables (e.g., `DDD_PAYMENTS_DISABLED`).
- **Application Layer Enforcement**: Checks happen at the start of use case execution in `application/` services.
- **Graceful Blocking**: The system blocks new initiations but continues to process/reconcile existing in-flight transitions.
- **Frontend Awareness**: The UI dynamically hides or disables features based on the backend kill switch configuration.

## Consequences
* **Positive**: Immediate mitigation of production risks without code deploys; improved safety during maintenance windows.
* **Negative**: Adds a configuration layer that must be managed and audited; risk of accidentally leaving a switch "Off".

## Invariants Protected
- Domain integrity during external system failure or internal remediation.

## Rejected Alternatives
- **Stopping the Server**: Too extreme; breaks all features including those that are functioning correctly.
- **Runtime DB Flags**: Rejected for the first phase to keep implementation simple and "fail-safe" (env vars are harder to "accidentally" toggle via a UI bug).
