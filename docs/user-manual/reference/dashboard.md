---
title: "Reference — Dashboard"
roles: [admin, field_service]
screen: dashboard
order: 101
---

# Reference — Dashboard

**Path:** Admin → Dashboard (the default landing page after login)

---

## Page Layout

The Dashboard is the command centre for daily operations. It is divided into:

1. **Header** — greeting, global search, and CSV export button.
2. **Pending alert banner** — appears in yellow when bookings need review.
3. **KPI cards** — four summary metrics.
4. **Bookings table** — the most recent bookings, filterable.
5. **Right column** — revenue breakdown chart, system health, quick actions, and notifications.

---

## KPI Cards

| Card | Source | Notes |
|------|--------|-------|
| **Revenue** | Sum of confirmed + completed `totalAmountCents` | In VT |
| **Bookings** | Total booking count | Subtitle shows confirmed count and pending count |
| **Active Tours** | Products with `isActive = true` | |
| **Uptime** | BetterStack integration | Shows "Configure" if BetterStack not set up |

---

## Bookings Table Controls

| Control | Effect |
|---------|--------|
| **Global search** (top right) | Searches customer name, tour, ID, date, status, amount |
| **Date range** — This Week / This Month / All Time | Filters by booking creation date |
| **Status dropdown** | Filters by Confirmed / Pending / Cancelled / All |
| **All →** link | Navigates to the full Bookings screen |

Clicking a row in the bookings table opens a **Booking Modal** with quick Confirm / Cancel buttons — useful for rapid triage without navigating away from the Dashboard.

---

## Revenue Breakdown Chart

A bar chart showing revenue split by product category (Tours vs. Transfers). Hover over a bar for the exact VT value. Click **Details →** to navigate to the full Analytics screen.

---

## Quick Actions

Three shortcut buttons:
- **New Booking** → navigates to Admin → Bookings (open Create Booking dialog from there).
- **Create Promo** → navigates to Admin → Promotions.
- **View Reports** → navigates to Admin → Reports.

---

## System Health

Shows a live uptime status dot (green = operational, red = down, yellow = unknown) and a link to the BetterStack monitoring dashboard. The uptime value refreshes every 5 minutes.

---

## Notifications

If there are unread notifications (e.g., new bookings, payment failures, system alerts), they appear in a gradient card at the bottom of the right column. Click **View All →** to go to Admin → Notifications.
