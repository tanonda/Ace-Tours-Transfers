---
title: "Reference — Fraud Queue"
roles: [admin]
screen: fraud
order: 112
---

# Reference — Fraud Queue

**Path:** Admin → Fraud (or Admin → Fraud Review Queue)

The Fraud screen handles the review of bookings flagged by the system's automated risk assessment rules.

---

## KPI Summary Cards

- **Pending Review** — The total number of flagged bookings currently in the review queue.
- **Critical Risk** — Bookings flagged with critical-level signals (potential bot attacks).
- **High Risk** — Bookings flagged with high risk score values.
- **Total Exposure** — The total financial value in VUV of all bookings in the queue.

---

## Risk Levels

The system classifies risk into four levels based on its score (0 to 100):
- 🔴 **Critical** — High score, usually multiple high-severity signals like rapid bursts. Requires immediate action.
- 🟠 **High** — Suspicious patterns requiring manual review before confirming.
- 🟡 **Medium** — Mild anomalies (e.g., large group counts or duplicate details).
- 🟢 **Low** — Minor issues, usually safe to approve.

---

## Fraud Signals Reference

The system evaluates bookings for these specific anomalies:
- **EMAIL_VELOCITY** — Same email address used for multiple bookings in a short window.
- **IP_VELOCITY** — Multiple bookings originating from the same IP address.
- **IP_BURST** — Rapid-fire bookings from a single IP (bot indicator).
- **DUPLICATE_BOOKING** — Details exactly matching another existing booking.
- **HIGH_PAX_COUNT** — Unusually high passenger/guest count.
- **HIGH_VALUE_ORDER** — Extremely large order amount.
- **DISPOSABLE_EMAIL** — Domain matches temporary/disposable email providers.
- **SUSPICIOUS_NAME** — Name field contains spam patterns or gibberish.

---

## Queue Table & Controls

- **Search box** — Filters the list by customer name, email, or tour.
- **Risk Level filter** — Restricts the table to specific risk levels.
- **Bulk Action bar** — Check multiple bookings to **Approve All** or **Dismiss All** simultaneously.

---

## Actions

Clicking on a row opens the **Fraud Review Detail Dialog**:
- **Approve (Clear Flag)** — Approves the booking, clearing the fraud status and sending confirmation emails.
- **Dismiss (Cancel)** — Cancels the booking and releases the seats.
- **Whitelist Email** — Whitelists the customer email address so future bookings from them are never flagged.
