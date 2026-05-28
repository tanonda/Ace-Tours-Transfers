---
title: "Workflow 10 — Reading the Audit Log"
roles: [admin]
screen: audit-logs
order: 10
---

# Workflow 10 — Reading the Audit Log

The **Audit Log** is a complete, immutable record of all significant actions taken in the system. Use it to answer questions like "Who cancelled that booking?", "When was this capacity changed?", or "Who updated the payment gateway settings?"

> **Roles** — `admin` only.

---

## Two Log Types

Navigate to **Admin → Audit Log**. The page has two tabs:

| Tab | What it records |
|-----|----------------|
| **Inventory Events** | Booking confirmations, cancellations, seat holds, capacity changes, and blackout additions/removals. |
| **Admin Actions** | Changes to payment gateways, feature flags, site settings, payment reconciliations, and system recovery runs. |

---

## Retention Policy

All audit log entries are retained for **12 months** from the date of the event. After 12 months, entries are automatically purged. Use **Export CSV** to archive records you need to keep longer.

---

## Inventory Events Tab

### Filters

| Filter | What it does |
|--------|-------------|
| **Product** | Restrict to events affecting a specific tour or transfer. |
| **Action Type** | Filter by event type (see table below). |
| **Show** | Limit results to the last 50 / 100 / 200 / 500 entries. |
| **Search** | Free-text search across action, performed-by, and product name. |
| **From / To** | Date range filter. |

### Event Types

| Action | What happened |
|--------|--------------|
| `booking_confirmed` | A booking was moved to Confirmed status. |
| `booking_cancelled` | A booking was cancelled. |
| `hold_created` | A seat hold was created (customer started checkout). |
| `hold_expired` | A seat hold expired (customer abandoned checkout). |
| `hold_released` | A seat hold was released (payment failed or booking cancelled). |
| `capacity_updated` | An availability slot's total capacity or blocked count was changed. |
| `blackout_created` | A blackout date was added. |
| `blackout_deleted` | A blackout date was removed. |

### Reading an Entry

Each row shows: **Time**, **Action** (coloured badge), **Product**, **Quantity** (seat change, positive or negative), **Performed By** (user or system), and **Details** (metadata summary).

**Click any row** to open the full detail dialog, which shows:
- Exact timestamp
- Product name and ID
- Performed By
- Quantity change
- Additional metadata (booking ID, hold ID, reason, etc.)
- **View raw JSON** — expandable section for technical debugging.

---

## Admin Actions Tab

### Filters

| Filter | What it does |
|--------|-------------|
| **Action Type** | Filter by the type of admin action (gateway update, flag toggle, etc.). |
| **Entity Type** | Filter by what was changed (payment gateway, feature flag, site settings, booking, system). |
| **Show** | Limit to last 50–500 entries. |
| **Search** | Free-text search across action, user, and entity name. |
| **From / To** | Date range filter. |

### Common Admin Action Types

| Action | What happened |
|--------|--------------|
| `gateway.update` | Payment gateway settings were modified. |
| `gateway.credentials_update` | API keys or credentials were changed. |
| `gateway.set_default` | The default payment gateway was changed. |
| `flag.toggle` | A feature flag was enabled or disabled. |
| `settings.update` | Site settings were updated. |
| `payment.reconcile` | Payment reconciliation was run. |
| `payment.sync` | Payment sync was triggered. |
| `recovery.run` | A booking recovery run was executed. |
| `recovery.dry_run` | A recovery dry run (preview only, no changes). |

### Change Diff

When you click an Admin Action row, the detail dialog shows a **Change Diff** — side-by-side **Before** and **After** panels in JSON format. This is particularly useful for auditing gateway credential changes or settings updates.

---

## Exporting the Audit Log

Click **Export CSV** (either tab) to download the currently filtered log as a spreadsheet. This is the recommended method for archiving records before the 12-month retention window closes.

**Inventory Events CSV columns:** Time, Action, Product, Quantity, Performed By, Details.

**Admin Actions CSV columns:** Time, Action, Entity Type, Entity Name, Entity ID, Performed By, IP Address.

---

## Common Audit Scenarios

**"A customer says they were charged but the booking shows cancelled — what happened?"**

1. Search Inventory Events for `booking_cancelled` and the customer's booking ID (from the Bookings screen).
2. Check the timestamp and Performed By — was it cancelled by staff or automatically?
3. Cross-reference with Admin Actions for any payment-related events on the same day.

**"Who changed the payment gateway settings?"**

1. Go to Admin Actions tab.
2. Filter by **Action Type → Gateway Update** or **Credentials Update**.
3. Check the Performed By column and open the row for the full Before/After diff.

**"Why did availability suddenly drop on a date?"**

1. Go to Inventory Events tab.
2. Filter by **Product** (the affected tour) and **Action Type → capacity_updated** or **blackout_created**.
3. Check the timestamp and who made the change.
