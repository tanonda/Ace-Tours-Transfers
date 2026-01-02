# Architecture Narrative: Ace Tours Evolution

*Written for a tired senior engineer at 2am.*

## The Core Concept: Authority vs. Convenience
We separate the world into **Authority** (the truth) and **Convenience** (the view).

### 1. The Write Path (Authority)
When a user clicks "Book", an **Application Service** coordinates the request. It loads the **Aggregate** (e.g., `Booking`). The aggregate is the only place logic lives. It asks: *"Does this violate any rules?"* 

If it's valid, the aggregate changes state and records a **Domain Event** (e.g., `BookingCreated`). This event is an immutable fact. The database commit happens here. The world has changed.

### 2. Side Effects & Sagas
We don't do side effects (emails, inventory locking) inside the transaction. Instead, an **Event Dispatcher** multicasts the event.

- **Inventory Handler**: Sees `BookingCreated`, updates the `TourInstance` capacity.
- **Email Handler**: Sees the event, sends the confirmation.

Wait, what if the user doesn't pay? A **Saga** (e.g., `BankTransferReconciliationSaga`) tracks the booking's lifecycle. It doesn't enforce rules; it watches time and event history. After 48 hours without a `PaymentConfirmed` event, it issues a **Command** back to the Application Service to "Expire" the booking.

### 3. The Read Path (Convenience)
Our frontend needs data fast. We don't join 10 tables. Instead, **Projections** (Handlers) subscribe to events. When `PaymentConfirmed` hits, the `RevenueByDayHandler` updates a single row in the `revenue_daily` table.

This read model is **disposable**. If it gets corrupted, we delete it and replay the events from Day 1 to rebuild the truth.

### 4. Guardrails (The "Why")
- **Aggregates** prevent double-bookings.
- **Sagas** handle the "messy middle" of long-running payments.
- **Projections** keep the UI snappy without complicating the domain.
- **Pricing Context** ensures we never lose a Vatu to a rounding error in a controller.

*Trust the Aggregate. Subscribe to the Event. Ignore the Read Model for Decisions.*
