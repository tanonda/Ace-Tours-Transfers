---
title: "Reference — Staff & Users"
roles: [admin]
last_updated: 2026-05-29
screen: staff-users
order: 121
---

# Reference — Staff & Users

**Paths:** Admin → Staff Management & Admin → Customer Management

Management controls are divided into two dedicated interfaces: **Staff Management** (for administrators and field service operators) and **Customer Management** (for registered customer profiles).

---

## 1. Staff Management

Staff Management oversees accounts with `admin` and `field_service` role privileges.

### Permissions Hierarchy
- **Admin:** Full system privileges (all bookings, billing, system settings, user management, analytics).
- **Field Service:** Read-only access to bookings and calendar dashboards. Access to system settings, billing, or users is disabled.

### Operations
- **Add Staff Member:** Create accounts using a name, email address, password, and role.
- **Welcome Email:** Creating an account sends a welcome email with a login link. Click **Resend Welcome** in the dropdown if a user does not receive the invite.
- **Suspend/Activate:** Suspend access instantly without deleting the account. Suspended staff members are logged out and blocked from logging in.
- **Reset Password:** Administrators can force-reset a staff member's password.
- **Bulk Actions:** Select multiple rows to **Suspend** or **Activate** staff members in one click.

---

## 2. Customer Management

Customer Management monitors registered public customer profiles.

### Customer Stats Panel
Provides high-level metrics including total customers, total booking counts, and lifetime value/total spend.

### Customer Directory
- **Search & Filter:** Search customer name, email address, or phone number. Toggle **Show Inactive** to see suspended customer accounts.
- **View Profile:** Opens a user profile detail drawer showing registration dates, full contact information, and lifetime booking value.
- **Booking History:** Details all past, pending, completed, or cancelled bookings associated with the customer.
- **Suspend Account:** Block customer login capabilities.
- **Reset Password:** Generate a new login password for the customer.
- **Export List:** Downloads a CSV file with guest names, emails, phones, role, booking counts, total spent, and join dates.
