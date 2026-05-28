---
title: "Reference — Recovery Operations"
roles: [admin]
screen: recovery
order: 113
---

# Reference — Recovery Operations

**Path:** Admin → Recovery (or Admin → Recovery Operations)

The Recovery Operations screen provides disaster recovery controls and data consistency checking tools to verify that database state perfectly matches live payment records and booking capacity.

---

## Live Monitoring Panels

- **Integrity Guard Status:**
  - 🟢 **Healthy** — All integrity verification checks pass successfully.
  - 🔴 **Violation** — Out-of-sync indicators or database schema violations detected.
- **Migrations Applied:** Lists the database migration ID currently running.
- **Issues Found:** The current count of detected database discrepancies.

---

## Recovery Actions & Tools

### 1. Re-Scan System
Re-runs database and payment logs comparison checking to refresh the live inconsistency stats.

### 2. Run Recovery Playbook
Triggers automatic schema checks and updates all `tour_instances.confirmed_count` fields from actual booking registers.
- **Dry Run:** Checks for consistency issues without writing changes to the database.
- **Execute Recovery:** Requires confirming the high-privilege prompt by typing `I_AM_SURE`.

### 3. Reset Admin Dashboards
Clears client-side browser cache for all analytics, bookings, and product pages, forcing a fresh load from the database on next load. *Note: This operation is safe and does not modify database data.*

---

## Manual Review Queue & Remediation

When inconsistencies are found, they are listed in the review queue table with severity ratings:
- 🔴 **CRITICAL** — Needs immediate remediation (e.g., payment exists but no booking or inventory allocation).
- 🟠 **WARNING** — Mismatches in count records.
- 🟡 **INFO** — Minor data alignment recommendations.

### Inconsistency Types:
- **Orphaned Payment:** Received payment lacks a corresponding booking in the database.
  - *Fix:* Verify target checkout, manually create booking and link payment ID, or void in payment provider portal.
- **Orphaned Booking:** A booking exists but lacks payment records.
  - *Fix:* Link payment records, cancel booking, or request customer payment.
- **Inventory Mismatch:** Database confirmation counts differ from allocated bookings.
  - *Fix:* Click **Repair** to force recalculation.
- **Payment Without Inventory:** Payment received but booking instance could not allocate capacity.
  - *Fix:* Click **Create Instance** to manually create and allocate slots on the schedule.
