---
title: "Reference — Notifications (Admin)"
roles: [admin, operator]
screen: notifications
order: 116
---

# Reference — Notifications (Admin)

**Path:** Admin → Notifications (or click the bell icon in header)

The Notifications screen centralizes real-time system alerts, booking activity alerts, and staff broadcasts. It includes tools to broadcast alerts to specific team members or the entire staff.

---

## Metric Summary

- **Total** — Cumulative notifications recorded in the system.
- **Unread** — Number of unread notifications for the currently logged-in user.
- **Broadcasts** — Messages sent manually to all staff.
- **Alerts** — High-priority warnings and error notifications from system tasks.

---

## Notification Types & Badges

- 🔵 **Info** — Informational alerts (e.g., normal booking creation).
- 🟢 **Success** — Task completed successfully (e.g., successful payment/refund).
- 🟡 **Warning** — Needs attention (e.g., double-booking warning, near-capacity product alerts).
- 🔴 **Alert (Error)** — Failure requiring immediate action (e.g., payment webhook failure, database timeout).

---

## Action Controls

### Inbox Toolbar
- **Search box:** Filter notifications by title, subject, or message text.
- **Type Filter:** Filter list to show only Info, Success, Warning, or Alert messages.
- **Unread only Button:** Toggles visibility to hide previously read notifications.
- **Mark all read:** Marks all inbox items as read in one click.

### Individual Notification Options
Hovering over a notification card reveals the action menu:
- **Mark read** — Toggle unread status.
- **View page** — Navigate directly to the related booking or screen link.
- **Delete** — Permanently remove the notification from your inbox feed.

---

## Compose Staff Broadcasts

Administrators can compose notifications from the *Message Board* tab:
- **To:** Target "All Staff" or select a specific staff member.
- **Type:** Categorize the notification (Info, Success, Warning, Alert).
- **Subject:** Enter the message header (max 100 characters).
- **Message:** Write the message body text (max 1000 characters).
- **Link (Optional):** Attach an internal route link (e.g. `/admin/bookings`) that users can click to investigate.
- **Preview:** Click **Preview** to verify the notification layout before sending.
