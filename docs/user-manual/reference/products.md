---
title: "Reference — Products Screen"
roles: [admin]
screen: products
order: 106
---

# Reference — Products Screen

**Path:** Admin → Products

The Products screen is the master catalog where administrators create, edit, deactivate, or delete tours and transfers.

---

## Screen Statistics

Four KPI cards summarize catalog health and overall booking metrics:
- **Tours** — The number of active tour products in the system.
- **Transfers** — The number of active transfer products in the system.
- **Bookings** — Cumulative bookings matching the product list.
- **Revenue** — Aggregated booking revenue across all listed products.

---

## Filter & View Controls

- **Category Tabs** — Filter the list by category:
  - **All (Count)** — Shows all products.
  - **Tours (Count)** — Filters to tour items.
  - **Transfers (Count)** — Filters to airport/island transfer items.
- **Smart Search Input** — Filters items by title or category.
- **Show Hidden Toggle** — Slide to show or hide deactivated/inactive products (marked with an `EyeOff` or `Hidden` badge).
- **View Mode Buttons** — Choose your preferred display layout:
  - **List View** — A condensed layout focusing on product title, category, pricing, duration, and capacity.
  - **Grid View** — A visually-rich layout showcasing the product's hero image, title, and key stats.
  - **Detailed Table View (Default)** — A tabular format showing Product, Category, Price/Stats, Status, and action columns with selection checkboxes for bulk actions.

---

## Product Dialog Fields

When adding or editing a product, the dialog contains the following parameters:

| Section | Field Name | Type | Purpose |
|---------|------------|------|---------|
| **Core** | Title | Text | Public title of the product. |
| | Category | Select | `tour` or `transfer`. |
| | Description | Rich Text | Main website details page text. |
| | Duration | Text | Approximate length of the activity (e.g., "3 hours", "Full day"). |
| | Image URL | Text/Upload | Hero image stored in Cloudinary. |
| | Is Active | Switch | Control visibility on the storefront. |
| **Capacity** | Default Capacity | Number | Base capacity used when no custom availability slot is defined. |
| **Pricing** | Pricing Model | Select | `per_person` (individual rates) or `group` (flat package rate). |
| | Adult Price | Number | Per-person rate (in VUV) for adults. |
| | Child Price | Number | Per-person rate (in VUV) for children. |
| | Infant Price | Number | Per-person rate (in VUV) for infants (under 2). |
| | Pet Price | Number | Per-person rate (in VUV) for pets. |
| | Group/Package Rate | Number | Flat rate (in VUV) for the entire booking. |

---

## Deletion Behaviors

The system employs a smart delete mechanism to safeguard financial data:
1. **Initial Delete Attempt** — Clicking **Delete** checks for linked records (bookings or availability slots). If found, the product status is soft-deleted. The item is hidden from the storefront but preserved in the admin panel to protect historical data integrity.
2. **Force Delete** — If the product is soft-deleted, opening the delete prompt again reveals a red **Force Delete Everything** option. Clicking this permanently erases the product and all associated bookings, payments, and schedules. **Warning: This cannot be undone.**
