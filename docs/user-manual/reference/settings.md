---
title: "Reference — Settings Deep Dive"
roles: [admin, owner]
screen: settings
order: 118
---

# Reference — Settings Deep Dive

**Path:** Admin → Settings

The Settings module contains the general configuration panel for contact information, email servers, e-wallet instructions, search engine tags, and website feature flags.

---

## Settings Tabs

### 1. Contact Info
Manages public contact data shown on the footer and contact page:
- Public email address, telephone number, and physical office location.

### 2. Social Media
- Configures links to Facebook, Instagram, and other custom platforms (TripAdvisor, YouTube).

### 3. WhatsApp Widget
- **Enable Widget:** Show/hide the floating WhatsApp chat button.
- **WhatsApp Phone Number:** Target phone number for customer messages (with country code, e.g., `+678 7114045`).
- **Widget Position:** Place the button in the bottom-right or bottom-left corner.
- **Greeting Message:** Custom greeting shown in the chat window.

### 4. Email Config
- Configures the target administrator notification email, outgoing email display name (From Name), and base Website URL.

### 5. Payment Instructions
Configures checkout and email text instructions for offline payment options:
- **Bank Transfer:** Set Account Name, Account Number, Bank Name, and Reference Format.
- **Cash on Delivery:** Set instructions (e.g. "Pay driver") and accepted currencies (e.g. VUV, AUD, NZD).
- **E-Wallets:** Set merchant telephone number, reference instructions, and deposit receipt upload guidelines.

### 6. SEO & GEO
- Title templates, default description, site tags, default Open Graph share image, and Schema.org local business metadata.

### 7. Analytics
- **Google Analytics 4:** Paste Measurement ID (`G-XXXXXXXXXX`) to start visitor tracking.
- **Google Tag Manager:** Paste Container ID (`GTM-XXXXXXX`) for tag management.

### 8. Integrations
- Toggles the active review provider (Trustpilot, Google Reviews, or None). Includes environment details for Google Places API and Trustpilot widgets.

### 9. Feature Flags
- Toggles system-wide modules on/off dynamically (e.g., offline bookings, promotional banners, multi-currency display).

### 10. Backlinks
- Manage external links and cross-promotions for SEO optimization.

### 11. Coming Soon Mode
- **Coming Soon Toggle:** Redirects public visitors to the coming soon landing page.
- **Countdown Timer:** Input targeted launch date and toggle countdown display.
- **Slideshow Images:** Upload, sort, and remove background images.
- **Reviews Section:** Configure the number of guest reviews displayed on the coming soon page.
