---
title: "Reference — Capacity Dashboard"
roles: [admin]
screen: capacity-dashboard
order: 104
---

# Reference — Capacity Dashboard

**Path:** Admin → Availability Dashboard

The Capacity Dashboard allows admins to monitor real-time seat availability, view historical and future bookings, and adjust the passenger capacity or blocked seats for specific tour dates.

---

## Metric Cards (KPIs)

At the top of the dashboard, four summary cards show metrics for the selected date range:

1. **Total Slots** — The total number of unique date/product availability records currently defined.
2. **Sold Out** — The number of slots where remaining capacity is exactly `0`.
3. **Critical (>90%)** — The number of slots where guest utilization is at or above 90% but not yet fully sold out.
4. **Avg Utilization** — The average booking fill rate across all loaded slots.

---

## Date & Presets Selector

You can change the active window of slots shown in both Table and Calendar views:
- **Date Inputs** — Click the `From` and `To` date fields to select a custom range.
- **Preset Buttons** — Click **7 days**, **30 days**, or **90 days** to instantly shift the range relative to today.
- **Refresh Button** — Manually refetch the data from the server. The dashboard also auto-refreshes every 30 seconds.

---

## Calendar View Tab

A monthly grid representing booking density:
- **Green Cell** — At least one slot on this date has high availability.
- **Yellow Cell** — At least one slot on this date has limited availability (utilization between 70% and 89%).
- **Orange Cell** — At least one slot has critical availability (90% to 99%).
- **Red Cell** — All slots on this date are fully sold out (100% utilization).
- **Grey/Empty Cell** — No slots or products are configured for this date.
- **Interactions** — Clicking any calendar day filters the Table View below to show only slots active on that date. Click **Clear date filter** to restore the full list.

---

## Table View Tab

A detailed spreadsheet layout displaying:
- **Product** — The name of the tour or transfer.
- **Date** — The scheduled date of execution.
- **Total Capacity** — The absolute maximum number of seats configured for this slot.
- **Confirmed** — The count of guests from confirmed or completed bookings.
- **Held** — Active temporary holds from checkout sessions in progress.
- **Blocked** — Seats manually reserved by staff (hidden from public storefront).
- **Remaining** — Remaining seats open for public sale (`Total - Confirmed - Held - Blocked`).
- **Utilization Bar** — Visual gauge showing the percentage of booked seats.
- **Status Badge** — `Available` (Green), `Limited` (Yellow), `Critical` (Orange), or `Sold Out` (Red).

---

## Actions & Dialogs

### 1. Add Slot (Create Availability)
Opens a dialog to initialize a new slot:
- **Product** — Select the target tour/transfer from the dropdown.
- **Date** — Choose the date for the new availability.
- **Total Capacity** — Input the default passenger capacity.
- **Blocked Seats** — Specify any seats to hold back immediately.

### 2. Edit Slot (Pencil Icon)
Allows you to adjust capacity values:
- **Total Capacity** — Adjust up or down. If reduced below the number of currently confirmed bookings, the remaining capacity will show a negative value (overbooked), but existing bookings will not be cancelled.
- **Blocked Seats** — Lock or release seats on the fly.
