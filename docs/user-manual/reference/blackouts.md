---
title: "Reference — Blackout Dates"
roles: [admin]
screen: blackouts
order: 105
---

# Reference — Blackout Dates

**Path:** Admin → Blackouts (or Admin → Blackout Dates)

The Blackout Dates page allows admins to block off specific calendar days for individual tours or transfers, hiding them from the public booking widget.

---

## Screen Panels

The screen is divided into three functional areas:

### 1. Create Blackout Date (Left Panel)
Use this form to add a new blackout:
- **Product Selector** — Dropdown menu containing all products (tours and transfers) currently defined.
- **Date Picker** — The date to be blocked. Past dates are greyed out and cannot be selected.
- **Reason Field** — A brief text box to document why the date is blocked (e.g., "Customs holiday," "Annual maintenance," "Private charter"). This is only visible to staff in the admin panel.
- **Block This Date Button** — Submits the request. The date becomes unbookable on the frontend immediately.

### 2. View Blackouts by Product (Right Panel)
A quick lookup tool to view scheduled blackouts for a single product:
- Select a product from the dropdown to see a list of its associated blackout dates and reasons.
- Features a **Remove** button (trash can) next to each date to quickly delete that blackout.

### 3. All Blackout Dates (Bottom Table)
A master list showing every blackout date currently configured in the database:
- Columns include: **Product**, **Date** (YYYY-MM-DD), **Reason**, and **Actions**.
- Rows are sorted chronologically by date.
- Clicking the **Remove** button on any row prompts a confirmation dialog to delete the blackout, immediately re-opening the slot for public booking.

---

## Critical Rules & Behaviors

- **No Auto-Cancellation** — Creating a blackout date on a day that already has bookings will **not** cancel or notify those customers. You must search the Bookings screen for that date first, resolve the bookings manually, and then configure the blackout.
- **Audit Logs** — Every blackout addition and removal is registered in the Audit Log as `blackout_created` or `blackout_deleted` respectively, attributing the action to the logged-in administrator.
- **Frontend Effect** — Once a blackout is saved, the dates disappear from the date pickers on the customer booking portal within seconds. There is no cache delay.
