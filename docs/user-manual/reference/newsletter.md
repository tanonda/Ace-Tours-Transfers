---
title: "Reference — Newsletter Management"
roles: [admin]
last_updated: 2026-05-29
screen: newsletter
order: 115
---

# Reference — Newsletter Management

**Path:** Admin → Newsletter (or Admin → Newsletter Management)

The Newsletter screen is used to manage marketing subscribers, toggle the public signup form, export lists, and construct email campaigns.

---

## Subscription Metrics

- **Total Subscribers** — Combined database count of all email signups.
- **Confirmed** — Double-opt-in subscribers ready for email campaigns.
- **Pending Confirmation** — Signed-up users who have not verified their email.
- **Unsubscribed** — Users who have opted out.

---

## Management Tasks

### 1. Managing Subscribers
- **Search:** Search subscribers by email or name.
- **Status Filter:** Filter list by Confirmed, Pending, or Unsubscribed.
- **Actions Menu:**
  - **Edit Name** — Update subscriber's display name.
  - **Manually Confirm** — Force-confirm a pending signup.
  - **Unsubscribe** — Manually opt out a user.
  - **Re-subscribe** — Re-add an unsubscribed user.
  - **Delete** — Permanently remove the subscriber.

### 2. Exporting List
- Click **Export CSV** to download a spreadsheet with subscriber emails, names, registration sources, double-opt-in status, and subscription dates. This CSV can be imported into third-party mailing tools like SendGrid or Mailchimp.

### 3. Public Settings
- **Signup Form Enabled Switch:** Turn the public footer newsletter subscription form on/off.

---

## Newsletter Campaigns

1. Click **Send Campaign** to open the broadcast composer.
2. Fill in the **Subject** and the **Message** body.
3. Click **Send to [N] subscribers** to queue the broadcast.
4. **Important:** Campaign delivery requires configuring external mail server details under *Settings → Email Config*.
