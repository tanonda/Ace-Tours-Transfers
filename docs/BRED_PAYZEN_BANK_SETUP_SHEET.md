# BRED Bank / Lyra PayZen — Setup Sheet

**For:** Saviera "Savi" Alexis — owner, Ace Tours & Transfers
**Prepared by:** Mark, website developer · 10 November 2026 (updated 11 November 2026)
**Bank contact:** Michael Dan, BRED (Vanuatu) Ltd, E-Banking — `mdan@bred.vu`

> **Safe to share with BRED.** This page contains no passwords, secret keys or customer data.

> **The short version**
> 1. Give BRED the settings in **§2**.
> 2. Ask BRED for the items in **§3**.
> 3. When BRED sends the details, enter them in the website using **§4**.
>
> If BRED asks for a **"notification URL"** (they may call it **"IPN"**), copy the address from
> §2 — or from the **Copy** button in Admin → Payments → BRED Bank → Configure. You do not need
> to understand it: it is a setting the bank stores, not a link you open.

---

## 1. Who does what

| Person | Role in this setup |
|---|---|
| **Savi** (`acetoursvanuatu@outlook.com`) | Merchant-account holder and owner. Sends/receives the emails and enters the PRODUCTION key in the website (see §6). |
| **Mark** (`markmal64@gmail.com`) | Website developer and the **technical contact** for the PayZen integration. Sets the notification URL and runs the TEST payment. |
| **Michael Dan** (`mdan@bred.vu`) | BRED E-Banking Merchant Officer. Sends the Shop ID, TEST key, production-key process and shop configuration. |
| **John Lew** (`john@pacificbedbank.com`) | Bedbank contact. **Not** the website developer and not the PayZen integrator — he does not need website files. |

> BRED's "Technical Contact Details" on the e-commerce application should name **Mark**, not John.
> If it says John, ask Michael Dan to correct it.

---

## 2. Give these settings to BRED

Copy the table below into BRED's form or email. The notification URL must be copied **exactly** —
lower-case, no spaces, no full stop at the end.

| Setting | Value to give BRED |
|---|---|
| Business | Ace Tours & Transfers Vanuatu — `https://acetoursvanuatu.com` |
| Merchant-account holder | Saviera "Savi" Alexis |
| Technical contact | Mark — `markmal64@gmail.com` |
| Integration | Lyra PayZen **hosted payment page** (signed form). Card numbers are entered on PayZen's page, never on our website. |
| **Notification URL** (BRED may say **"IPN"**) | `https://acetoursvanuatu.com/api/payments/webhook/bred-bank` |
| **Notification when a payment is cancelled or abandoned** (PayZen usually lists it as *"Instant Payment Notification URL on cancellation"*) | **Turned on**, sent to the same notification URL above |
| Return / redirect URL (only if the form requires one) | **No fixed value** — the website sends it with each payment. If a box must be filled, use `https://acetoursvanuatu.com/` as a placeholder. |
| Signature algorithm | **HMAC-SHA-256** |
| Currency | **VUV** — whole vatu, no cents (VT 5,000 is sent as `5000`) |
| Capture | Same-day, automatic (no per-payment manual approval) |
| 3-D Secure | Enabled |
| Refunds | Made in the PayZen Back Office by us; the website records them |
| Website files / repository access | **Not needed** — the integration is already built |

**Same address for TEST and PRODUCTION.** Use the one notification URL for both shops. The website
checks which shop (TEST or PRODUCTION) sent the result and rejects a test result that arrives while
the shop is in production mode — so there is no second address to get wrong.

**Why the cancelled/abandoned notification matters.** By default PayZen only tells the website
about payments that were paid or refused. If a customer opens the payment page and then cancels or
closes it, the website hears nothing, so the booking waits and you receive a *"payment needs
review"* email for a payment that was never made. With this notification turned on, the website
is told straight away and simply closes that attempt.

**If the bank's form asks for a "return", "redirect" or "success" URL:** there is **no fixed value
to give BRED**. The website sends the return address with every payment because it has to carry the
booking reference (`/payment/success?booking=…`), so a single address would not work. If the form
insists on a value, put `https://acetoursvanuatu.com/` as a placeholder and add the note
*"the website supplies the actual return address on each payment."* Do **not** use
`/payment/success` — without the booking reference that page has no booking to show and looks like a
blank/pending success.

---

## 3. Ask BRED for these

Tick these off as BRED provides them:

- ☐ **Merchant account** for online card payments, in the business name, settling to our BRED account.
- ☐ **PayZen Back Office access** — one user for Savi (owner) and a separate user for Mark (developer).
- ☐ The **8-digit Shop ID** (it is a number like `12345678`).
- ☐ The **TEST key** (visible in the Back Office), and how/when the **PRODUCTION key** is issued.
- ☐ **VUV enabled** on the shop, and confirmation that whole-vatu amounts are accepted.
- ☐ Confirmation of the **payment page address**: the standard `https://secure.payzen.eu/vads-payment/`, or a BRED-specific one.
- ☐ **HMAC-SHA-256** selected as the signature algorithm.
- ☐ **Same-day automatic capture** (no manual validation per payment).
- ☐ **3-D Secure enabled.**
- ☐ **Notification (IPN) URL** set for **both** TEST and PRODUCTION, with **automatic retry** if our site is momentarily down.
- ☐ **Notification for cancelled and abandoned payments turned on**, to the same notification URL, for **both** TEST and PRODUCTION.
- ☐ **Test card numbers** — and how many test payments are needed before the production key is issued.
- ☐ **Fees** (per transaction and monthly), settlement timing, and how refunds are handled.

---

## 4. When BRED sends the details — enter them in the website

You need to be logged in as an **admin**.

1. Open **Admin → Payments**, find the **BRED Bank** card and click **Configure**.
2. Fill the fields:

   | Field | What to enter |
   |---|---|
   | **Shop Id** | The **8-digit** Shop ID from the Back Office (digits only — e.g. `12345678`) |
   | **Mode** | Choose **TEST** first (it is a dropdown: TEST or PRODUCTION) |
   | **Test Key** | The TEST key from the Back Office — paste it, do not retype it |
   | **Production Key** | Leave **empty** until BRED issues the production key |
   | **Payment Url** | Leave **empty** unless BRED gives you a special payment-page address |

3. Click **Save**. Then switch the BRED Bank gateway **on**.
4. Ask **Mark** to run the first TEST payment (use BRED's test cards). Do **not** make BRED the
   default for guests yet.

> The **Notification URL for BRED** is shown at the top of this same Configure window, with a
> **Copy** button. If BRED asks for it again at any point, copy it from there.

**Later, when BRED issues the production key:** open Configure again → set **Mode** to
**PRODUCTION** → paste the **Production Key** → Save. Mark will confirm the first live payment.

---

## 5. Two messages you can copy

### 5.1 Send to BRED (Michael Dan)

> **Subject:** PayZen shop configuration — Ace Tours & Transfers
>
> Hi Michael,
>
> To finish the PayZen shop setup for Ace Tours & Transfers, please configure the following for
> **both the TEST and PRODUCTION shops**:
>
> - **Instant Payment Notification (IPN) URL** — use the same address for both:
>   `https://acetoursvanuatu.com/api/payments/webhook/bred-bank`
> - **Notification for cancelled and abandoned payments:** please turn this on as well, sent to
>   the same address, so our website is told when a customer leaves the payment page without paying
> - **Signature algorithm:** HMAC-SHA-256
> - **Currency:** VUV (whole vatu — VT 5,000 is sent as `5000`, no cents)
> - **Capture:** same-day automatic; **3-D Secure** enabled
>
> Please also send us the **8-digit Shop ID**, confirm the **TEST key** is visible in the Back
> Office, and let us know how the **PRODUCTION key** is issued.
>
> Our technical contact for the website integration is **Mark** — `markmal64@gmail.com`.
>
> Thank you,
> Savi
> Ace Tours & Transfers

### 5.2 If BRED asks you something technical

Forward their email to **Mark** (`markmal64@gmail.com`) and say: *"BRED asked this — can you reply?"*
Do not guess an answer, and do not send production keys, passwords or website files by email.

---

## 6. Security rules — please follow

- **Never email, WhatsApp or text the PRODUCTION key.** Type or paste it yourself in
  Admin → Payments. The TEST key is also private; share it only with Mark.
- **Do not send website files or GitHub access to the bank.** The integration is already built and
  deployed; BRED needs only the settings in §2.
- **The Back Office login is for shop settings**, not for the website. Use separate users for you
  and Mark.
- **No card numbers** are ever stored on our website — customers enter them on PayZen's page.
- Payment credentials are stored encrypted on the server; the daily admin account is separate.

---

## 7. Where the technical detail is

| Document | Who it is for |
|---|---|
| [Technical overview](./PAYZEN_TECHNICAL_OVERVIEW.md) | BRED's and Global Bedbank's technical reviewers |
| [Go-live runbook](./BRED_PAYZEN_GO_LIVE.md) | The full operator/developer go-live runbook, including the 13-point checklist |
| [Sandbox testing guide](./PAYMENT_SANDBOX_TESTING.md) | Field-level TEST-mode reference |
| [Security and handover](./SECURITY_HANDOVER.md) | Security and safe-access rules |

**Questions?** Ask Mark — `markmal64@gmail.com`.
