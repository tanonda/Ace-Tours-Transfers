---
title: "Reference — Promotions Screen"
roles: [admin]
screen: promotions
order: 109
---

# Reference — Promotions Screen

**Path:** Admin → Promotions (or Admin → Promotions & Discounts)

The Promotions screen lets admins create, toggle, and test customer discount codes that apply automatically at checkout.

---

## Promotion Statistics

- **Total Codes** — Count of all created promo codes.
- **Active** — Count of codes currently active and within their valid date range.
- **Total Uses** — Sum of all completed checkouts that applied a promo code.
- **Expired** — Count of codes past their `validTo` date.

---

## Promotions Table Columns

| Column | Description |
|--------|-------------|
| **Code** | The promo code (uppercase string, e.g., `SUMMER26`) with a quick clipboard-copy button. |
| **Discount** | Percent off (e.g., `10%`) or fixed VUV value. Includes minimum purchase requirements. |
| **Applicable** | Specificity scope: `all`, `tours`, or `transfers`. |
| **Valid Period** | Start and End dates (YYYY-MM-DD). |
| **Uses** | Usage ratio (e.g., `12 / 100`) accompanied by a progress bar. |
| **Status Badge** | `Active` (Green), `Upcoming` (Blue), `Expired` (Red), or `Disabled` (Grey). |
| **Actions** | Toggle switch (enable/disable), Edit (pencil), and Delete (trash). |

---

## Create & Edit Dialog Fields

- **Code** — Unique identifier string entered by customers. Case-insensitive but forced to uppercase.
- **Description** — Internal reference note detailing the discount purpose.
- **Discount Type** — Dropdown select: `percentage` or `fixed`.
- **Discount Value** — Numerical discount amount (as percentage number or VUV units).
- **Min. Purchase** — Minimum booking total (in VUV) required to apply the code. Set to `0` to bypass.
- **Max Uses** — Maximum times this code can be successfully processed. Set to `0` for unlimited.
- **Valid From / Valid To** — Date range boundaries controlling availability.
- **Applicable To** — Dropdown select limiting the code to specific categories: `all`, `tours`, or `transfers`.
- **Status (isActive)** — Switch toggle to instantly activate or deactivate the promotion.

---

## Test Code Section

A sandboxed form card located at the bottom of the page:
- **Input Field** — Type any code to verify.
- **Test Button** — Submits a post request to `/api/promotions/validate` against a simulated VT 5,000 order subtotal.
- **Results Card** — Displays validation outcome:
  - Green (Valid) showing discount amount.
  - Red (Invalid) detailing failure reasons (expired, below minimum purchase, etc.).
  - Serves as a pre-launch sanity check before releasing codes to the public.
