# Phase 3 — Google Business Profile & Local SEO Pack

**Goal:** Win the Port Vila local "map pack" — the 3 businesses Google shows above the
organic results for searches like "tours Port Vila", "airport transfers Vanuatu",
"things to do Port Vila". This is the **fastest** SEO win available and is independent of
the website rendering work (Phases 1–2).

Everything below is copy-paste ready. Set it up at **https://business.google.com**.

---

## ⚠️ FIRST: Fix the NAP inconsistency (do this before anything else)

"NAP" = Name, Address, Phone. Google ranks local businesses partly on the **exact same**
NAP appearing identically across your website, Google Business Profile, and every
directory. Right now the codebase has two different sets:

| Field | In structured data (`seo.tsx`) — what crawlers see | In `render.yaml` env vars |
|-------|---------------------------------------------------|---------------------------|
| Phone | `+678 711 4045` | `+678 7114045` (same number, fine) |
| Email | `acetoursvanuatu@outlook.com` | now aligned across code |

**✅ RESOLVED:** Canonical public contact is now consistent in code:

- **Phone:** `+678 711 4045`
- **Email:** `acetoursvanuatu@outlook.com`

(The mail-server identity `SMTP_FROM=no-reply@acetours.vu` is intentionally left as-is —
it's bound to the SMTP host/SPF for deliverability and is never shown to customers as a
contact address.)

Use these exact values in the GBP below and on every directory in the citations list.

---

## Verified business details (from your live structured data)

- **Name:** Ace Tours & Transfers Vanuatu
- **Street:** Kumul Highway, Port Vila
- **Region/City:** Port Vila, Shefa Province, Vanuatu
- **Geo:** -17.7334, 168.3273
- **Hours (per current structured data):** 07:00–18:00, **Mon–Sat** (Sunday not listed)
- **Price range:** $$
- **Website:** https://acetoursvanuatu.com
- **Facebook:** https://www.facebook.com/acetoursvanuatu
- **Instagram:** https://www.instagram.com/acetoursvanuatu

> **You have no storefront yet → set GBP up as a Service-area business (SAB).** During
> setup, when asked "Do you have a location customers can visit?", answer **No**. Then
> **hide the address** and define your service area as Port Vila + Efate (see §3). This
> is the correct, policy-compliant choice for a transfers/tours operator without a
> walk-in office, and it still ranks in the Port Vila map pack. Keep the Kumul Highway
> address/geo in the *website's* structured data (it gives Google a locality signal),
> but do not display a pin-point address on the public GBP.

---

## 1. Business name

```
Ace Tours & Transfers Vanuatu
```

Use your real-world business name **only**. Do not stuff keywords (e.g. "Ace Tours Port
Vila Airport Transfers & Day Tours") — Google suspends profiles for this, and it's the
single most common cause of local ranking penalties.

## 2. Primary & additional categories

Categories are the #1 local ranking factor. Choose the closest real Google categories:

- **Primary:** `Tour operator`
- **Additional:**
  - `Airport shuttle service`
  - `Transportation service`
  - `Sightseeing tour agency`
  - `Car service` (only if you do private transfers)

## 3. Service area

Add these as service areas:

```
Port Vila, Vanuatu
Efate Island, Vanuatu
Bauerfield Airport (VLI), Vanuatu
Mele, Vanuatu
```

## 4. Hours

Use the hours that match your live structured data (`openingHoursSpecification` in
`client/src/components/seo.tsx`) so GBP and the website agree:

```
Mon–Sat  07:00–18:00
Sun      Closed
```

> Optional later tweak: if you actually meet early/late flights, adding an
> "Open 24 hours" note for **airport transfers specifically** captures "open now"
> searches. Not changing it now per your decision to keep current data — just flagging
> it as an easy future win.

## 5. Business description (max 750 chars)

```
Ace Tours & Transfers is a locally owned Port Vila operator offering reliable airport
transfers and unforgettable Efate Island day tours across Vanuatu. From the moment you
land at Bauerfield Airport, our friendly drivers get you to your resort safely and on
time, day or night. Explore the best of Efate with us — the Blue Lagoon, Mele Cascades
waterfalls, Port Vila markets, and scenic island circuits — in comfortable,
air-conditioned vehicles with knowledgeable local guides. Whether you need a private
transfer, a group charter, or a full-day sightseeing tour, we tailor every trip to you.
Book online at acetoursvanuatu.com or message us on WhatsApp. Trusted by travellers for
punctual service, fair pricing, and genuine Ni-Vanuatu hospitality.
```

(That's ~700 chars. Front-loads "Port Vila", "airport transfers", "Efate Island day
tours", "Vanuatu" — the terms you want to rank for, in natural language.)

## 6. Services (add each as a GBP "Service" with its own short description)

Replace the example names/prices with your **actual** tours and fares. Pull the real list
from your admin product catalogue. Suggested structure:

**Transfers**
- `Airport Transfer – Arrival` — Meet & greet at Bauerfield Airport (VLI), direct to your
  hotel. Available for all flights, day or night.
- `Airport Transfer – Departure` — Hotel pickup timed to your flight.
- `Private Transfer (Port Vila & Efate)` — Point-to-point private car service.
- `Group / Charter Transfer` — Vans for families and groups.

**Tours** *(use your real tour titles + prices)*
- `Blue Lagoon Day Tour`
- `Mele Cascades Waterfall Tour`
- `Port Vila City & Markets Tour`
- `Efate Island Circuit (Full Day)`
- `Custom / Private Charter Tour`

For each service, add a 1–2 sentence description that naturally includes the location
("…in Port Vila", "…on Efate Island").

## 7. Photos (huge for local ranking & clicks — aim for 15–25 to start)

Upload, named/grouped roughly like this:
- **Logo** (square) and **cover** (wide hero shot)
- Vehicles (clean, branded if possible) — interior + exterior
- Drivers/guides with guests (people photos get the most engagement)
- Each tour destination: Blue Lagoon, Mele Cascades, Port Vila waterfront/markets,
  island viewpoints
- Airport meet-and-greet in action

Reuse the high-res images already on your Cloudinary account. Geotag where possible.

## 8. Attributes to enable

- "Online appointments / bookings" → link `https://acetoursvanuatu.com`
- "Identifies as locally owned" (if applicable)
- Languages spoken (English, Bislama, French — match what your guides actually speak)
- Wheelchair-accessible (only if true)

## 9. Booking / action links

- **Website:** https://acetoursvanuatu.com
- **Appointment link:** https://acetoursvanuatu.com/tours
- Add your WhatsApp (`+678 711 4045`) as the phone so the "Call" / WhatsApp action works.

---

## 10. Reviews engine (the other top-3 local ranking factor)

Map-pack ranking is heavily driven by **review count + recency + your replies**.

1. After every trip, send guests a direct review link (GBP gives you a short
   `g.page/...` link once verified). Put it on the booking confirmation email and a small
   card in the vehicle.
2. **Reply to every review** (good and bad) within a day — Google rewards owner activity.
   Work the location into replies naturally: *"Thanks for touring the Blue Lagoon with us
   in Port Vila, Sarah!"*
3. Target a steady trickle (e.g. 2–4/week) rather than a one-off burst — bursts look
   fake and can be filtered.

> You already render `aggregateRating`/`Review` JSON-LD on tour pages, so reviews compound
> across both Google Maps and your organic rich results.

---

## 11. Local citations (do these after GBP is live — same exact NAP on each)

Free, high-value for a Vanuatu tourism operator. Submit identical Name/Address/Phone +
website to:

1. **Vanuatu Tourism Office** — https://www.vanuatu.travel/ (operator listing — the
   highest-authority local backlink you can get)
2. **TripAdvisor** — claim/create the "Ace Tours & Transfers" listing (Port Vila →
   Transport / Tours)
3. **Viator** / **GetYourGuide** — list bookable tours (also a sales channel)
4. **Google Maps** (covered by GBP) + **Bing Places for Business**
   (https://www.bingplaces.com)
5. **Facebook** & **Instagram** — ensure the profile address/phone/website match exactly
6. Local directories: Yellow Pages Vanuatu, any "Port Vila things to do" roundups

Consistency is the point: byte-for-byte identical NAP everywhere.

---

## Suggested order of operations

1. Decide canonical phone + email → fix the code mismatch (I can do this).
2. Create & **verify** the Google Business Profile (verification can take days — start now).
3. Fill in categories, description, services (with your real tours/prices), photos.
4. Set up the review request flow on booking confirmations.
5. Submit the citation list with identical NAP.
6. Add Bing Places.

Items 2–6 are off-code work only you can do (they need your Google login and business
verification). Item 1 is code — tell me the canonical phone/email and I'll align it.
```
