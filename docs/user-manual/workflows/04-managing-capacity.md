---
title: "Workflow 4 — Managing Capacity and Availability"
roles: [admin]
screen: capacity-dashboard
order: 4
---

# Workflow 4 — Managing Capacity and Availability

The **Availability Dashboard** gives you a real-time view of how many seats remain for each product on each date, and allows you to adjust capacity on the fly.

> **Roles** — `admin` only.

---

## Understanding Capacity Concepts

| Term | Meaning |
|------|---------|
| **Total Capacity** | The maximum seats/spots available for a product on a given date. Set when you create an availability slot. |
| **Confirmed** | Seats occupied by confirmed bookings. |
| **Held** | Seats temporarily reserved by in-progress checkout sessions. These expire automatically if payment is not completed. |
| **Blocked** | Seats manually removed from sale (e.g., reserved for walk-ins, guide seats, or equipment). |
| **Remaining** | `Total − Confirmed − Held − Blocked`. This is what's shown as bookable on the website. |

**Utilization Status:**

| Status | Threshold |
|--------|-----------|
| 🟢 Available | < 70% full |
| 🟡 Limited | 70–89% full |
| 🔴 Critical | 90–99% full |
| ⛔ Sold Out | 100% full |

---

## Dashboard Overview

Navigate to **Admin → Availability Dashboard**.

At the top, four KPI cards show:
- **Total Slots** — number of date/product combinations in the selected range.
- **Sold Out** — how many are fully booked.
- **Critical (>90%)** — nearly full slots needing attention.
- **Avg Utilization** — average fill rate across all slots.

The date range defaults to today + 30 days. Use the **From / To** date pickers or the **7 days / 30 days / 90 days** preset buttons to change it.

---

## Table View

The **Table View** tab lists every availability slot with columns for:
- Product name, date, total capacity, confirmed count, held count, blocked count, remaining, utilization bar + %, and status badge.

**Filtering:**
- **Status dropdown** — show only Available / Limited / Critical / Sold Out slots.
- **Product dropdown** — filter by a specific tour or transfer.
- **Calendar day filter** — click a date in Calendar View to instantly filter the table to that day.

---

## Calendar View

Switch to the **Calendar View** tab to see a monthly colour-coded grid:
- 🟢 Green = at least one available slot.
- 🟡 Yellow = one or more limited slots.
- 🔴 Orange = one or more critical slots.
- 🔴 Red = one or more sold-out slots.
- Grey = no availability data for that day.

Click a coloured day cell to filter the Table View to show only that day's slots. Click the same cell again (or click **Clear date filter**) to remove the filter.

---

## Adding a New Availability Slot

When a product has no availability data for a date, it will not appear on the booking calendar. You need to add a slot.

1. Click **Add Slot** (top right of the Availability Dashboard).
2. In the dialog:
   - **Product** — choose from the grouped list (Tours / Transfers).
   - **Date** — cannot be in the past.
   - **Total Capacity** — the maximum number of guests.
   - **Blocked Seats** — reserve some seats upfront (e.g., `2` for guide + equipment).
3. The **Available for booking** preview updates live as you type.
4. Click **Create Availability Slot**.

The slot appears immediately in the table and calendar.

---

## Editing an Existing Slot

1. Find the slot in the Table View.
2. Click the **pencil icon** (Edit) on that row.
3. In the dialog, adjust:
   - **Total Capacity** — increase if a larger vehicle becomes available; decrease if capacity is reduced.
   - **Blocked Seats** — adjust how many seats are held back from public booking.
4. The preview shows the updated remaining count before you save.
5. Click **Save Changes**.

> **Note** — Reducing capacity below the current confirmed count will result in negative remaining capacity (shown in red). The system will not cancel existing bookings — you must manage overbooking manually.

---

## Common Capacity Scenarios

**Scenario: The tour is sold out but a customer calls to book**

1. Open the slot in the Edit dialog.
2. Increase **Total Capacity** by the number of extra guests you can accommodate.
3. Save. The public website will immediately show available seats.
4. Create a manual booking for the customer.

**Scenario: You need to reserve seats for a VIP group**

1. Open or create the slot.
2. Set **Blocked Seats** to the number of VIP seats.
3. The VIP seats are hidden from public booking. When the group confirms, add a manual booking and reduce Blocked Seats accordingly.

**Scenario: A large group wants to book most of the tour**

1. Check current availability on the dashboard.
2. If the group fills >50% of capacity, consider blocking the remaining seats so the tour doesn't run with a mix of groups.
3. Create a single manual booking for the entire group using the group's total guest count.

---

## Auto-Refresh

The dashboard refreshes capacity data automatically every **30 seconds**. You can also click **Refresh** (top right) at any time to force an immediate reload.
