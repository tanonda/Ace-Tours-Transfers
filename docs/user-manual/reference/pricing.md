---
title: "Reference — Pricing Screen"
roles: [admin]
screen: pricing
order: 107
---

# Reference — Pricing Screen

**Path:** Admin → Pricing (or Admin → Pricing Versions)

The Pricing screen handles the creation, viewing, and historical tracking of scheduled price changes.

---

## Technical Concept

The system uses **effective-date pricing versions**. Prices are not bound directly to the booking date based on when the customer purchased, but rather on when the tour/transfer takes place. The active price is the latest version whose `Effective From` date is on or before the requested booking date.

---

## Form Fields (New Pricing Version Card)

- **Product Selector** — Select a product to set the price for. Group pricing products are flagged with a `(group)` suffix.
- **Effective From** — Date (YYYY-MM-DD) when this pricing version goes live.
- **Entry Currency Select** — Choose the input currency symbol (VUV, USD, AUD, EUR, etc.). Since all amounts are stored in VUV, this converts the input values using the system rates.
- **Pricing Model Radio** — Choose **Per Person** or **Group / Package**. If the selection disagrees with the product's default, a warning banner appears.
- **Adult Price** — Required for Per Person model.
- **Child Price** — Optional.
- **Infant Price** — Optional (under 2 years old).
- **Pet Price** — Optional.
- **Package / Group Rate** — Flat rate for the entire vehicle/booking regardless of guest count.
- **Live Preview Panel** — Shows the calculated VUV value alongside display currency equivalents.

---

## View Panels

- **Product Filter Select** — Choose a product in the **View Pricing History** card to filter the history lists.
- **Current Active Price Box** — Highlighted box in blue showing the pricing version currently applied to new bookings.
- **Upcoming Schedule List** — Highlighted in amber, showing scheduled versions whose effective date is in the future.
- **All Pricing Versions Table** — A grid at the bottom displaying all pricing versions across past, active, and future periods:
  - Columns: **Product**, **Effective From**, **Model** (Group/Per Person badge), **Adult / Package**, **Child**, **Infant**, **Pet**, and **Status**.
  - **Status Badges** — `Active` (Green), `Scheduled` (Orange), or `Past` (Grey).
  - Rows are sorted in reverse chronological order (newest effective date first).
