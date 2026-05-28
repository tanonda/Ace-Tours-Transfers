---
title: "Workflow 8 — Reports and Performance Monitoring"
roles: [admin]
screen: reports
order: 8
---

# Workflow 8 — Reports and Performance Monitoring

The **Reports** screen consolidates financial and operational data into three tools: a revenue chart, a filterable booking report, and a daily guest manifest.

> **Roles** — `admin` only.

---

## KPI Summary Cards

At the top of **Admin → Reports**, four cards show at-a-glance metrics:

| Card | What it shows |
|------|---------------|
| **Total Revenue** | Sum of all confirmed and completed bookings (in VT). |
| **Total Bookings** | Count of all bookings, with confirmed count as subtitle. |
| **Monthly Avg Revenue** | Total revenue divided by number of months with data. |
| **Pending Payments** | Total value of all pending bookings. Shown in red if > 0. |

---

## Revenue Chart

The **Revenue Chart** tab shows a bar chart of monthly revenue over all time. Hover over a bar to see the exact VT amount for that month. This is useful for identifying seasonal peaks and year-over-year trends.

---

## Booking Report

The **Booking Report** tab provides a filterable, exportable table of bookings:

**Filters:**
- **From / To** — date range (based on booking creation date, not tour date). Defaults to the last 3 months.
- **Status** — All / Confirmed / Pending / Completed / Cancelled.
- **Search** — customer name, email, or tour name.

The filter bar shows a live count of matching bookings and their total revenue value.

**Clicking a row** opens a detail pop-up with full booking information.

**Exporting:** Click **Export CSV** to download the filtered bookings as a spreadsheet. Columns include: Booking ID, Customer name, Email, Phone, Tour, Date, Adults, Children, Infants, Pets, Amount, Status.

---

## Guest Manifest

The **Guest Manifest** tab generates a daily guest list — the essential document for guides and operations staff.

1. Set the **Date** to the tour date you need.
2. The table populates with all non-cancelled bookings for that day, showing: guest name, email, phone, tour/transfer, pax breakdown, status, and amount.
3. **Export CSV** — downloads the manifest as a spreadsheet.
4. **Print** — opens a formatted, print-ready version in a new window with Ace Tours & Transfers branding. Print from there, or save as PDF.

> **Tip** — The manifest is filtered to exclude cancelled bookings. If you need to see cancellations (e.g., for waitlist management), use the Booking Report tab instead.

---

## Analytics Dashboard

For deeper analytics (revenue by category, conversion rates, booking trends), navigate to **Admin → Analytics**. This screen provides:

- Revenue breakdown by tour vs. transfer category.
- Booking volume trends over time.
- Top-performing products by bookings and revenue.

---

## Recommended Reporting Routine

| Frequency | Task |
|-----------|------|
| **Daily** | Check pending bookings on the Dashboard. Print/export tomorrow's Guest Manifest. |
| **Weekly** | Review the Booking Report for the past 7 days. Check for pending payments > 48 hours old. |
| **Monthly** | Export the Booking Report for the calendar month. Review the Revenue Chart for trends. Compare to the same month last year. |
| **Seasonally** | Review Analytics for top-performing products. Adjust pricing versions and availability for the upcoming season. |
