---
title: "Reference — Reconciliation"
roles: [admin]
screen: reconciliation
order: 111
---

# Reference — Reconciliation

**Path:** Admin → Reconciliation (or Admin → Management & Reconciliation)

The Reconciliation screen is used to verify payments for manual/offline bookings (like bank transfers and cash) and manage stale online payments (e.g., Stripe checkouts that are stuck in processing).

---

## Tabs

### 1. Offline Payments Tab
This tab displays manual or offline bookings awaiting payment verification.

- **Metric Cards:**
  - **Pending Offline** — Total count of offline bookings awaiting verification.
  - **Total Value** — Sum of pending offline booking amounts in VUV.
- **Automated CSV Upload:**
  - Drop a bank statement CSV in the upload zone.
  - The system automatically parses the statement and matches transaction references (like `BKG-XXXX`) against pending bookings.
  - Returns a success toast indicating matched bookings and any flagged amount mismatches.
- **Offline Awaiting Table:**
  - Lists the booking ID, creation date, customer name, email, payment method (e.g., bank transfer, cash), and amount.
  - **Actions:**
    - **Confirm** — Manually confirms the booking, updating its status to Confirmed.
    - **X (Cancel)** — Cancels the booking and releases held capacity.

### 2. Stale Online Tab
This tab lists online bookings (Stripe or Vatu Pay) that have remained in a `processing` status longer than the system's threshold.

- **Stale Payments Table:**
  - Lists the Payment ID, amount, current status, gateway reference, and actions.
  - **Actions Dropdown:**
    - **Auto Sync** — Queries the payment gateway API to update the status.
    - **Force Complete** — Manually confirms the payment. **Caution:** This will confirm the booking and send tickets to the customer.
    - **Force Fail** — Manually sets the status to failed and cancels the booking.
