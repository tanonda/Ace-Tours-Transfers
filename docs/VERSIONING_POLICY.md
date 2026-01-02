# Event Versioning & Replay Policy

As an event-driven system, our domain events are immutable records of historical truth. We never alter the past.

## Event Evolution Rules

1.  **Immutable Facts**: Once an event (e.g., `BookingCreated`) is published, its name and schema are permanent. Do NOT rename fields or change types.
2.  **Versioning via Naming**: If a breaking change is required, issue a new event (e.g., `BookingCreatedV2`).
3.  **Additive Changes**: Adding optional fields is permitted but requires a bump in the system's "Understanding Version".
4.  **Legacy Support**: Handlers for old event versions must remain until a full migration is verified and the old events are purged from history.

## Replay Policy (The "Holy Grail")

Read models are projections of truth, not the truth itself. They must be disposable.

1.  **Idempotency**: Every projection handler MUST be idempotent. `handle(event)` must produce the same result regardless of how many times it runs.
2.  **Atomic Rebuild**: Replays should ideally happen in a shadow table/transaction before swapping to minimize downtime.
3.  **No Side Effects**: Projection handlers MUST NOT send emails, call external APIs, or emit new domain events during replay.
4.  **Chronological Order**: Events must be replayed in the exact order they were committed.

## Replay Safety Checklist
- [ ] Handler used `UPSERT` or `ON CONFLICT` logic.
- [ ] No `fetch` or `axios` calls in the handler.
- [ ] No `eventDispatcher.dispatch` in the handler.
- [ ] Logic relies only on the event payload and current read-model state.

