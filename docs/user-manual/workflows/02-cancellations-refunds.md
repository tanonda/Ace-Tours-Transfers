---
title: "Workflow 2 — Cancellations and Refunds"
roles: [admin]
screen: bookings
order: 2
---

# Workflow 2 — Cancellations and Refunds

> **Roles** — `admin` only. Field Service staff can view bookings but cannot cancel or delete them.

---

## Cancelling a Single Booking

1. Go to **Admin → Bookings**.
2. Locate the booking using search or filters.
3. Click **⋯ → Cancel** on the booking row.  
   — or —  
   Open **View Details** and click the **Cancel** button inside the dialog.
4. The status changes to **Cancelled** immediately. The seats previously held by this booking are released and become available again for new bookings on that date.

> **Important** — Cancelling a booking in the system does **not** automatically issue a refund. You must process any refund separately through your payment gateway (Stripe Dashboard or Vatu Pay portal). See the Refund Process section below.

---

## Bulk Cancellation

1. In the Bookings table, tick the checkboxes for each booking you want to cancel.
2. In the blue bulk-action bar, click **Cancel**.
3. Confirm when prompted. All selected bookings move to **Cancelled** status simultaneously.

---

## Archiving vs. Permanently Deleting

The system uses a **soft delete** (archive) by default:

- **Archive (Delete)** — the booking is hidden from the standard view but the record is preserved in the database. To restore or view archived bookings, enable **Show Deleted** in the filter bar.
- **Permanently Delete** — available only when viewing archived bookings (toggle **Show Deleted** on). This erases the record completely and cannot be undone.

> **Caution** — Permanent deletion removes all payment and audit history for that booking. Only use this for obvious test entries or data corrections authorised by management.

**To archive a booking:**

1. Click **⋯ → Delete** on a booking row (when **Show Deleted** is **off**).
2. A confirmation dialog appears: _"Archive this booking?"_ Click **Delete**.

**To permanently delete:**

1. Enable **Show Deleted** in the filter bar.
2. Find the archived booking (it shows a grey **Deleted** badge).
3. Click **⋯ → Permanently Delete**.
4. Confirm the permanent deletion. This action cannot be undone.

---

## Refund Process

The Ace Tours Manager system records the cancellation but does not initiate the refund — that is handled outside this application through the payment processor.

**For Stripe payments:**

1. Log in to the [Stripe Dashboard](https://dashboard.stripe.com).
2. Navigate to **Payments** and find the original charge using the booking amount and date.
3. Click **Refund** and enter the amount (full or partial).

**For Vatu Pay payments:**

1. Log in to your Vatu Pay merchant portal.
2. Locate the original transaction and issue a refund per Vatu Pay procedures.

**After issuing the refund:**

- Update the booking note (via **Edit Booking**) to record the refund date and amount, e.g., _"Full refund issued via Stripe on 2026-06-01."_
- This creates a written record that will appear in audit logs.

---

## Cancellation Policy Reminders

The system does not automatically enforce a cancellation policy. Staff must apply the business rules manually:

| Time before departure | Policy (example — confirm with management) |
|---|---|
| > 72 hours | Full refund |
| 24–72 hours | 50% refund |
| < 24 hours | No refund |

> **Tip** — Note the booking's **Tour date** (not the cancellation date) when calculating the refund entitlement.

---

## What Happens After Cancellation

- The booking status changes to **Cancelled** in the system.
- The previously held seats are immediately returned to available capacity — they will appear as bookable on the public website within seconds.
- The customer does **not** receive an automatic cancellation email from the system (as of v1.0). Staff should email or phone the customer directly to confirm the cancellation and any refund.
- The cancellation event is recorded in the **Audit Log** under **Inventory Events → booking_cancelled**.
