---
title: "Workflow 1 — Taking and Confirming a Booking"
roles: [admin, field_service]
screen: bookings
order: 1
---

# Workflow 1 — Taking and Confirming a Booking

Bookings arrive through two channels: **customer self-service** on the public website, and **manual entry** by staff on behalf of a customer who phones or emails. This chapter covers both.

---

## How Online Bookings Work

When a customer completes a booking on the website, the system:

1. Creates a booking record with status **Pending**.
2. Processes payment (Stripe or Vatu Pay, depending on the active gateway).
3. Sends the customer an automated confirmation email.
4. Increments the confirmed-seat count for that date, reducing visible availability.

A **Pending** booking holds seats temporarily but is not counted as revenue until it moves to **Confirmed** or **Completed**.

> **Note** — If a customer's payment fails, the booking status moves to **Failed**. The seat hold is released automatically.

---

## Checking for New Bookings

Navigate to **Admin → Bookings** (or view the **Recent Bookings** table on the Dashboard).

The Dashboard shows a yellow alert banner if there are any pending bookings: _"N bookings pending review."_ Click **Show pending →** to filter the list instantly.

On the Bookings screen:

- Use the **Status** dropdown to filter by **Pending**, **Confirmed**, etc.
- Use the **Smart search** box to find a booking by customer name, tour, booking ID, or date.
- Click any column header (**ID**, **Customer**, **Tour / Service**, **Date**, **Status**, **Amount**) to sort.

---

## Creating a Manual Booking

> **Roles** — `admin` only

1. Go to **Admin → Bookings**.
2. Click **New Booking** (top right).
3. Fill in the form:
   - **Customer details** — name, email, phone.
   - **Product** — select the tour or transfer from the dropdown.
   - **Date** — must be an available, non-blacked-out date.
   - **Guests** — adult count (required); child, infant, and pet counts (optional).
   - **Promo code** — apply if the customer has one.
   - **Notes** — any special requirements (dietary, accessibility, pickup point).
4. Click **Create Booking**. The booking is created with status **Confirmed** by default for manually-entered bookings.

---

## Confirming a Pending Booking

> **Roles** — `admin` only

**Single booking:**

1. Find the row in the Bookings table.
2. Click the **⋯** (actions) menu on the right.
3. Choose **Confirm** (the green tick option). The status updates instantly and the customer receives a confirmation email.

Alternatively, open **View Details** → click **Confirm** inside the booking detail dialog.

**Bulk confirm:**

1. Tick the checkboxes on the left of each row (or tick the header checkbox for all visible rows).
2. The blue bulk-action bar appears at the top of the table.
3. Click **Confirm** in the bulk-action bar.

---

## Booking Status Reference

| Status | Meaning |
|--------|---------|
| **Pending** | Payment submitted but not yet verified, or awaiting manual confirmation. Seats are held. |
| **Confirmed** | Booking is active. Seats are counted against capacity. Revenue is counted. |
| **Completed** | The tour/transfer has taken place. |
| **Cancelled** | Booking was cancelled. Seats are released. Revenue is reversed. |
| **Failed** | Payment failed. Seats are released. No revenue impact. |

---

## Viewing Booking Details

Click **View Details** (the eye icon in the ⋯ menu) to see:

- Full customer contact information (email, phone).
- Guest breakdown (adults / children / infants / pets).
- Payment amount and currency.
- Any notes or special requests.
- Booking ID (format: `ACT-XXXXXXXX`) to quote back to the customer.

---

## Editing a Booking

> **Roles** — `admin` only

1. Click **⋯ → Edit Booking** on any booking row.
2. Modify the date, guest count, or notes.
3. Click **Save**. The booking history is not overwritten; a new audit record is created.

> **Caution** — Changing the date does not automatically re-check capacity for the new date. Always verify availability on the **Availability Dashboard** before moving a booking to a heavily-loaded date.

---

## Exporting Bookings

> **Roles** — `admin` only

Click **Export CSV** (top right of the Bookings screen) to download all visible bookings (respecting the current search/filter) as a spreadsheet. The export includes: Booking ID, customer name and contact, tour, date, guest counts, amount, and status.

Alternatively, use **Reports → Booking Report** for a more powerful filtered export with date-range controls.
