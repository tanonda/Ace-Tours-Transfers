---
title: "Reference — Bookings Screen"
roles: [admin, field_service]
screen: bookings
order: 102
---

# Reference — Bookings Screen

**Path:** Admin → Bookings

---

## Toolbar

| Control | Roles | Effect |
|---------|-------|--------|
| **Refresh** | Both | Reloads the bookings list from the server. |
| **Export CSV** | Admin | Downloads all currently visible bookings as a CSV file. |
| **New Booking** | Admin | Opens the Create Booking dialog. |

---

## Filters and Search

| Control | Effect |
|---------|--------|
| **Smart search** | Searches across customer name, tour name, booking ID, date, status, and amount simultaneously. All typed tokens must match. |
| **Status dropdown** | All / Confirmed / Pending / Completed / Cancelled / Failed |
| **Show Deleted** checkbox | Includes soft-deleted (archived) bookings in the results. |
| **↕ sort toggle** | Cycles the date sort between newest-first and oldest-first. |

**Column sort:** Click any column header (**Booking ID**, **Customer**, **Tour / Service**, **Date**, **Status**, **Amount**) to sort by that column. Click again to reverse.

---

## Bulk Actions (Admin only)

Select rows using the left-side checkboxes (or the header checkbox for all). The blue bulk-action bar appears:

| Button | Effect |
|--------|--------|
| **Confirm** | Sets all selected bookings to Confirmed. |
| **Cancel** | Sets all selected bookings to Cancelled. |
| **Complete** | Sets all selected bookings to Completed. |
| **Delete** / **Permanently Delete** | Archives (soft delete) or permanently removes, depending on whether Show Deleted is on. |
| **Clear** | Deselects all. |

---

## Row Actions Menu (⋯)

| Action | Roles | Effect |
|--------|-------|--------|
| **View Details** | Both | Opens the booking detail dialog (read-only). |
| **Edit Booking** | Admin | Opens the edit dialog. |
| **Confirm** | Admin | Sets status to Confirmed. |
| **Cancel** | Admin | Sets status to Cancelled. |
| **Delete / Permanently Delete** | Admin | Archives or permanently removes the booking. |

---

## Booking Status Colours

| Status | Colour |
|--------|--------|
| Confirmed | Green |
| Pending | Yellow |
| Completed | Blue |
| Cancelled | Red |
| Failed | Orange |

---

## Booking ID Format

Booking IDs are shown as `#XXXXXXXX` (first 8 characters of the internal UUID, uppercase). The full reference used in reports and customer communications is `ACT-XXXXXXXX`.

---

## Create Booking Dialog Fields

| Field | Required | Notes |
|-------|----------|-------|
| Customer Name | ✅ | |
| Customer Email | ✅ | |
| Customer Phone | | |
| Product (Tour/Transfer) | ✅ | Dropdown of active products |
| Date | ✅ | Must be available |
| Adults | ✅ | |
| Children | | |
| Infants | | Under 2 years old |
| Pets | | |
| Promo Code | | Validated at submission |
| Notes | | Internal or customer-facing |

---

## Edit Booking Dialog Fields

Same fields as Create, plus the ability to change the booking status directly. Edits are audited.
