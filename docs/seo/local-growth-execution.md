# Local Growth Execution

Use this as the operating checklist for the next SEO push: Google Business Profile, review collection, landing-page backlinks, and fresh local content.

## Canonical NAP

Use the same details everywhere.

- Name: Ace Tours & Transfers Vanuatu
- Website: https://acetoursvanuatu.com
- Phone: +678 711 4045
- Email: acetoursvanuatu@outlook.com
- Service area: Port Vila, Efate Island, Bauerfield Airport (VLI), Mele

## Google Business Profile

Profile type: service-area business.

Do not keyword-stuff the business name. Use the real name:

```text
Ace Tours & Transfers Vanuatu
```

Primary category:

```text
Tour operator
```

Additional categories:

```text
Airport shuttle service
Transportation service
Sightseeing tour agency
Car service
```

Business description:

```text
Ace Tours & Transfers is a locally owned Port Vila operator offering reliable airport transfers and unforgettable Efate Island day tours across Vanuatu. From the moment you land at Bauerfield Airport, our friendly drivers get you to your resort safely and on time. Explore the best of Efate with us: the Blue Lagoon, Mele Cascades waterfalls, Port Vila markets, cultural experiences, and scenic island circuits in comfortable, air-conditioned vehicles with knowledgeable local guides. Whether you need a private transfer, a group charter, or a full-day sightseeing tour, we tailor every trip to you. Book online at acetoursvanuatu.com or message us on WhatsApp.
```

Services to add:

- Airport Transfer - Arrival
- Airport Transfer - Departure
- Port Vila Private Transfer
- Wharf / Cruise Ship Transfer
- Blue Lagoon Vanuatu Tour
- Mele Cascades Waterfall Tour
- Efate Island Day Tour
- Vanuatu Cultural Tour

Photo checklist:

- Logo
- Wide cover image
- Vehicle exterior
- Vehicle interior
- Driver or guide with vehicle
- Airport pickup or name-sign photo
- Blue Lagoon
- Mele Cascades
- Port Vila markets
- Cruise wharf pickup
- Happy guests, only with permission

## Review Collection

After Google Business Profile is verified, set this environment variable to the direct review link:

```text
GOOGLE_REVIEW_URL=https://g.page/r/REPLACE_ME/review
```

If you only have a Place ID, set:

```text
GOOGLE_PLACE_ID=REPLACE_WITH_PLACE_ID
```

The email templates use `GOOGLE_REVIEW_URL` first, then fall back to the Place ID review URL.

Guest message after a tour:

```text
Hi {first_name}, thank you for travelling with Ace Tours & Transfers today. If you enjoyed your {tour_or_transfer}, a short Google review would really help our local Vanuatu team. You can leave one here: {review_link}
```

Reply template for positive reviews:

```text
Thank you, {name}. We loved helping you with your {tour_or_transfer} in Port Vila. Reviews like this help travellers find a reliable local Vanuatu operator, and we really appreciate you taking the time.
```

Reply template for critical reviews:

```text
Thank you for the feedback, {name}. We are sorry this part of your experience did not meet expectations. Please contact us at acetoursvanuatu@outlook.com with your booking details so we can review what happened and improve the service for future guests.
```

## Landing-Page Backlinks

Ask partners to link to the most relevant landing page, not always the homepage.

Priority URLs:

- https://acetoursvanuatu.com/port-vila-airport-transfers
- https://acetoursvanuatu.com/efate-island-day-tours
- https://acetoursvanuatu.com/blue-lagoon-vanuatu-tour
- https://acetoursvanuatu.com/mele-cascades-tour
- https://acetoursvanuatu.com/vanuatu-cultural-tours
- https://acetoursvanuatu.com/port-vila-private-transfers

Hotel/resort outreach:

```text
Subject: Reliable Port Vila airport transfer option for your guests

Hi {name},

Ace Tours & Transfers is a local Port Vila operator providing airport transfers, private transfers, and Efate day tours for visitors staying around Vanuatu.

If your guests ask about getting from Bauerfield Airport to your property, this page may be useful:
https://acetoursvanuatu.com/port-vila-airport-transfers

We would be grateful if you could include it on your guest information, getting-here, or recommended transport page. We are also happy to discuss direct guest pickup procedures if that helps your team.

Kind regards,
Ace Tours & Transfers Vanuatu
```

Tourism/directory outreach:

```text
Subject: Local Vanuatu tour and transfer operator listing

Hi {name},

Could you please add or update the listing for Ace Tours & Transfers Vanuatu?

Name: Ace Tours & Transfers Vanuatu
Website: https://acetoursvanuatu.com
Phone: +678 711 4045
Email: acetoursvanuatu@outlook.com
Services: Port Vila airport transfers, private transfers, Efate Island day tours, Blue Lagoon tours, Mele Cascades tours, cultural tours

For the most relevant visitor page, please link to:
https://acetoursvanuatu.com/efate-island-day-tours

Thank you,
Ace Tours & Transfers Vanuatu
```

## Fresh Local Content

Seed the first four local guides:

```bash
npm run seo:seed-local-articles
```

Then:

- Confirm `/blog` shows the articles.
- Resubmit `https://acetoursvanuatu.com/sitemap.xml` in Google Search Console.
- Request indexing for `/blog` and each new article URL.
- Share each article on Facebook and in Google Business Profile posts.

## Weekly Rhythm

- Monday: post one Google Business Profile update.
- After every completed booking: send review link.
- Friday: reply to all new Google reviews.
- Weekly: outreach to 5 backlink targets.
- Monthly: review Search Console queries and add one new local guide.
