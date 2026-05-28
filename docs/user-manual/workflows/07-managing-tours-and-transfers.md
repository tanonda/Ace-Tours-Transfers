---
title: "Workflow 7 — Managing Tours and Transfers"
roles: [admin]
screen: products
order: 7
---

# Workflow 7 — Managing Tours and Transfers

The **Products** screen is where you create and manage all tours and transfers that appear on the public website and booking calendar.

> **Roles** — `admin` only.

---

## Products Overview

Navigate to **Admin → Products**. The screen shows:

- **Tabs** — All / Tours / Transfers (filters the list by category).
- **Stats cards** — counts of tours, transfers, bookings, and total revenue.
- **View modes** — Table (default, most information), List, or Grid.
- **Show Hidden** toggle — includes deactivated products in the list.

---

## Creating a New Product

1. Click **Add Product** (top right).
2. Fill in the product dialog:

| Field | Notes |
|-------|-------|
| **Title** | Displayed on the website and in bookings. |
| **Category** | Tour or Transfer. |
| **Description** | Rich text shown on the product detail page. |
| **Duration** | e.g., "3 hours" or "Full day". |
| **Image** | Upload a hero image (min 800 px wide recommended). |
| **Default Capacity** | Used when no specific availability slot exists for a date. |
| **Pricing Type** | Per Person or Group/Package. |
| **Adult / Child / Infant / Pet Price** | For per-person pricing (in VUV). |
| **Group Price** | For flat-rate group bookings. |
| **Is Active** | Whether the product is visible on the public website. |

3. Click **Save**. The product is immediately live on the website if **Is Active** is on.

---

## Editing a Product

1. Click the product title or the **pencil icon** in the Actions column.
2. Modify any field.
3. Click **Save**.

> **Tip** — Pricing set here is the product's base price. For scheduled price changes, use **Admin → Pricing** to create dated pricing versions on top of this.

---

## Deactivating vs. Deleting a Product

| Action | Effect |
|--------|--------|
| **Deactivate** (toggle Is Active off) | Hidden from the website. Existing bookings are not affected. Can be reactivated. |
| **Delete** | If the product has bookings or availability records, it is soft-deleted (hidden from storefront only). If it has no linked data, it is permanently deleted. |

To **force-delete** a product with linked bookings: after the initial delete attempt returns a soft-delete, a **Force Delete Everything** button appears in the confirmation dialog. This permanently erases the product and all its booking records — use only for genuine test data.

---

## Bulk Actions

Select multiple products using the checkboxes, then use the bulk-action bar to:

- **Activate** — make all selected products visible on the website.
- **Deactivate** — hide all selected products.
- **Delete** — delete all selected products (soft-delete if any have bookings).

---

## Product vs. Availability

Creating a product makes it appear in the system, but customers cannot book it until **availability slots** exist for specific dates. See **Workflow 4 — Managing Capacity** for how to add slots.

If a product's **Default Capacity** is set and a customer tries to book a date with no slot, the system falls back to the default capacity value for that date.
