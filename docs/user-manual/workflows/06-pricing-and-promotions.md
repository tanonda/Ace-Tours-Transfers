---
title: "Workflow 6 — Pricing and Promotions"
roles: [admin]
screen: pricing
order: 6
---

# Workflow 6 — Pricing and Promotions

Pricing is managed through two tools: **Pricing Versions** (scheduled price changes) and **Promotions** (discount codes).

> **Roles** — `admin` only.

---

## Pricing Versions

A Pricing Version is a price record that activates on a specific date. The system always applies the latest version whose **Effective From** date is on or before the booking date. Existing confirmed bookings are never repriced.

**Creating a version:**

1. Go to **Admin → Pricing → New Pricing Version**.
2. Select the **Product** and **Effective From** date.
3. Choose **Entry currency** (you can type in USD/AUD — stored as VUV).
4. Choose **Pricing Model**: Per Person (adult/child/infant/pet rates) or Group/Package (one flat rate).
5. Enter prices. The green preview shows the VUV equivalent.
6. Click **Create Pricing Version**.

**Viewing history:** Select a product in the **View Pricing History** panel. The active version is shown in blue; upcoming (scheduled) versions in amber; past versions in the full table below.

---

## Promotion Codes

1. Go to **Admin → Promotions → New Promo Code**.
2. Fill in: Code, Description, Discount Type (% or fixed VT), Discount Value, Min Purchase, Max Uses, Valid From/To, Applicable To (all/tours/transfers), Status.
3. Click **Create Code**.

**Managing codes:** The table shows all codes with status (Active/Upcoming/Expired/Disabled). Toggle the switch to enable/disable instantly. Use the pencil to edit, trash to delete.

**Testing a code:** Use the **Test a Promo Code** section at the bottom — enter a code and click **Test** to validate it against a VT 5,000 test order.

---

## Best Practices

- Set expiry dates on all promo codes.
- Set a **Max Uses** limit for high-value discounts.
- Test every code before distributing it to customers.
- Use the **View Pricing History** panel to confirm the correct version is active before peak season begins.
