---
title: "Workflow 9 — Managing Staff and User Access"
roles: [admin]
screen: staff
order: 9
---

# Workflow 9 — Managing Staff and User Access

The **Staff Management** screen controls who can log in to the admin panel and what they can do.

> **Roles** — `admin` only. Only admins can create, modify, or deactivate staff accounts.

---

## Access Roles

The system has two staff roles:

| Role | Badge colour | Access |
|------|-------------|--------|
| **Admin** | Purple | Full system access — bookings, products, pricing, CMS, settings, reports, staff management, audit logs. |
| **Field Service** | Blue | Read-only access to bookings and the calendar. Cannot access settings, financials, or user management. |

Use **Field Service** for guides, drivers, and operations staff who need to check the booking list and manifest but should not modify anything.

---

## Creating a Staff Account

1. Go to **Admin → Staff Management**.
2. Click **Add Staff Member**.
3. Fill in the form:
   - **Full Name** (required).
   - **Email** (required) — used for login.
   - **Username** (optional) — auto-generated from the email if left blank.
   - **Password** (optional) — if left blank, a welcome email with a password-set link is sent automatically.
   - **Access Role** — Admin or Field Service.
4. Click **Create Staff Account**.

A welcome email is sent immediately after creation (whether or not you set a password). The email contains a login link. If the email fails to send, use **Resend Welcome** from the staff table.

---

## Managing Existing Staff

Each staff row has a **⋯** (more actions) menu:

| Action | Description |
|--------|-------------|
| **View Details** | Shows name, email, username, user ID, and join date. |
| **Promote to Admin** | Upgrades a Field Service account to full Admin. Shows a warning — confirm carefully. |
| **Demote to Field Service** | Reduces an Admin to read-only Field Service access. |
| **Suspend Account** | Immediately prevents login. Account remains visible; can be reactivated. |
| **Activate Account** | Re-enables a suspended account. |
| **Reset Password** | Set a new password for the account (minimum 6 characters). |
| **Resend Welcome** | Resend the initial welcome/invite email. |

> **Caution** — You cannot suspend or demote your own account. This prevents accidental lockout.

---

## Bulk Actions

Select multiple staff with checkboxes, then use the bulk-action bar to **Activate** or **Suspend** in one step.

> **Note** — Your own account is automatically excluded from bulk status changes even if selected.

---

## Deactivating vs. Deleting

There is no permanent delete option for staff accounts. Use **Suspend** to revoke access without losing audit history. Suspended accounts are shown in the table with an orange **Suspended** badge (visible when **Show Inactive** is toggled on).

---

## Security Recommendations

- **Principle of least privilege** — assign Field Service unless the person genuinely needs admin capabilities.
- **Unique accounts** — never share login credentials. Each staff member should have their own account so audit logs correctly attribute actions.
- **Offboard promptly** — when a staff member leaves, suspend their account the same day.
- **Strong passwords** — require staff to set passwords of at least 12 characters. The system enforces a minimum of 6.
- **Review monthly** — periodically review the staff list and suspend any accounts that are no longer needed.
