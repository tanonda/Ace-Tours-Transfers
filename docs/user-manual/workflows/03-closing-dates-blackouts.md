---
title: "Workflow 3 — Closing Dates and Blackouts"
roles: [admin]
screen: blackouts
order: 3
---

# Workflow 3 — Closing Dates and Blackouts

A **blackout date** is a specific calendar day blocked for a specific product. When a blackout is active, that date is hidden from the public booking calendar — customers cannot select it.

> **Roles** — `admin` only.

---

## When to Use Blackouts

- **Public holidays** — e.g., Independence Day, Christmas.
- **Private events** — a tour venue is fully booked for a private group.
- **Vehicle or equipment maintenance** — the boat/minibus is unavailable.
- **Weather or seasonal closures** — cyclone season, monsoon.
- **Staff leave or shortage** — guide not available.

> **Important** — Blackout dates do **not** automatically cancel existing bookings on that date. If customers have already booked, you must contact them individually and cancel/rebook manually.

---

## Adding a Blackout Date

1. Navigate to **Admin → Blackout Dates**.
2. In the **Create Blackout Date** card (left panel):
   - **Product** (required) — select the tour or transfer to block.
   - **Date** (required) — pick the date to block. The date picker prevents selecting dates in the past.
   - **Reason** (optional) — enter a note, e.g., _"Public holiday — Independence Day"_. This is for internal reference only; customers do not see it.
3. Click **Block This Date**.

The blocked date appears immediately in the right panel under **View Blackouts by Product** and in the **All Blackout Dates** table at the bottom of the page.

> **Note** — Blackouts are product-specific. Blocking a date for one tour does not affect other tours or transfers. If you want to close the entire operation on a date, add a blackout for each product individually.

---

## Viewing Existing Blackouts

**For a specific product:**

1. In the **View Blackouts by Product** card (right panel), select a product from the dropdown.
2. All blocked dates for that product appear as a scrollable list, showing the date and reason.

**All products at once:**

The **All Blackout Dates** table at the bottom shows every blackout across all products, sorted by product and date.

---

## Removing a Blackout Date

To re-open a previously blocked date:

1. Find the blackout in the list (either in the product view panel or the all-blackouts table).
2. Click the **trash / Remove** button on the right of that row.
3. Confirm when prompted: _"Remove blackout for [date]?"_

The date is immediately available again for booking on the public website.

---

## Checking for Existing Bookings Before Blocking

Because blackouts do not cancel existing bookings automatically, always check for bookings before blocking a high-demand date:

1. Go to **Admin → Bookings**.
2. Filter by the relevant **Tour/Service** and search for the date.
3. If there are confirmed bookings on that date, contact those customers before adding the blackout.

---

## Blackout Audit Trail

All blackout creations and deletions are recorded in the **Audit Log** (Admin → Audit Logs → Inventory Events). Look for:

- `blackout_created` — records who added a blackout and when.
- `blackout_deleted` — records who removed a blackout and when.
