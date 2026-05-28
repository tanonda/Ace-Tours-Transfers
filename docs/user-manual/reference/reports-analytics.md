---
title: "Reference — Reports and Analytics"
roles: [admin]
screen: reports
order: 110
---

# Reference — Reports and Analytics

**Paths:** Admin → Reports & Admin → Analytics

These screens provide summaries, exports, and manifestations of operational and financial booking records.

---

## KPI summary Cards (Reports Screen)

- **Total Revenue** — Grand total of all payments from `confirmed` and `completed` bookings.
- **Total Bookings** — Count of all bookings.
- **Monthly Avg Revenue** — Total revenue divided by active calendar months.
- **Pending Payments** — Aggregated booking revenue waiting for payment verification.

---

## Reports Tabs

### 1. Revenue Chart Tab
Displays a vertical bar chart using recharts, grouping daily transaction records into monthly totals:
- Y-axis represents revenue values scaled in thousands (k).
- X-axis groups values chronologically by month.
- Tooltip displays detailed revenue metrics when hovering over bars.

### 2. Booking Report Tab
A searchable data grid focused on transaction exports:
- **Filters** — Custom `From` and `To` date fields, booking status dropdown, and a customer search bar.
- **Live Counter** — Shows matching bookings count and sum value dynamically as filters are changed.
- **Export CSV Button** — Downloads the current filtered view.
- **Table Columns** — ID, Customer, Tour/Transfer, Date, Pax, Amount, Status, and Actions (View Details).

### 3. Guest Manifest Tab
Generates operational daily rosters:
- **Date Selector** — Filters bookings by execution date.
- **Roster Grid** — Lists index number, guest name, contact details (email/phone), tour/transfer title, breakdown of passengers (adults/children/infants), status, and total amount.
- **Print Button** — Opens a printable page containing company branding, metadata, and tables, triggering the browser print prompt automatically.
- **Export CSV Button** — Downloads the manifest as a spreadsheet.

---

## Analytics Dashboard Panels

- **Revenue Breakdown Bar Chart** — Displays horizontal bars contrasting sales totals from Tours vs. Transfers.
- **Volume Over Time Line Chart** — Tracks daily booking frequency to identify demand trends.
- **Top Performing Products List** — Ranks active tours by booking frequency and total revenue.
