-- ============================================================================
-- Migration: Seed FAQ Content + Site Settings Defaults
-- Seeds FAQ Q&A pairs to CMS so admin can edit them in the CMS tab.
-- Seeds default site settings so the Settings tab shows pre-filled values
-- instead of empty fields.
--
-- Safe to re-run: ON CONFLICT DO NOTHING / DO UPDATE skips existing rows.
-- ============================================================================

-- ─── FAQ CONTENT ─────────────────────────────────────────────────────────────
-- Seeds 7 FAQs into cms_content so admin can edit them live in CMS → FAQ tab.
-- These match the hardcoded defaultFaqs in client/src/pages/faq.tsx.

INSERT INTO cms_content (block_slug, content_key, content_type, value, locale, sort_order)
VALUES
  ('faq', 'faq1_q', 'text',
    'Do I need to pay in advance?',
    'en', 10),
  ('faq', 'faq1_a', 'richtext',
    'No, we offer flexible payment options. You can pay securely online via credit card, or choose local payment methods like Cash on Delivery, Bank Transfer, BRED Bank, BSP, and various local e-wallets like WanTok Money, Digicel Mobile Money, and KwikPay.',
    'en', 20),

  ('faq', 'faq2_q', 'text',
    'What is your cancellation policy?',
    'en', 30),
  ('faq', 'faq2_a', 'richtext',
    'We offer a flexible cancellation policy. Cancellations made more than 48 hours before the scheduled tour or transfer are fully refundable. Cancellations within 48 hours may incur a fee. Please reach out to our team if you need to make changes to your booking.',
    'en', 40),

  ('faq', 'faq3_q', 'text',
    'Where do you pick up from?',
    'en', 50),
  ('faq', 'faq3_a', 'richtext',
    'We pick up from all major hotels, resorts, and the cruise ship terminal in Port Vila. During the booking process, you can specify your exact pickup location. We also provide dedicated airport transfers to and from Bauerfield International Airport.',
    'en', 60),

  ('faq', 'faq4_q', 'text',
    'Are your vehicles air-conditioned?',
    'en', 70),
  ('faq', 'faq4_a', 'richtext',
    'Yes! Your comfort is our priority. All our vans, buses, and private transfer vehicles are fully air-conditioned and regularly maintained to ensure a pleasant journey around Vanuatu.',
    'en', 80),

  ('faq', 'faq5_q', 'text',
    'Do you offer private or group tours?',
    'en', 90),
  ('faq', 'faq5_a', 'richtext',
    'We offer both! You can join one of our scheduled group tours to see the highlights of Efate, or you can book a private vehicle and driver for a customized itinerary tailored exactly to your preferences.',
    'en', 100),

  ('faq', 'faq6_q', 'text',
    'How can I contact from overseas?',
    'en', 110),
  ('faq', 'faq6_a', 'richtext',
    'You can reach us easily via WhatsApp at +678 7342389, or via email at acetoursvanuatu@outlook.com. We are available 24/7 to assist with your travel inquiries.',
    'en', 120),

  ('faq', 'faq7_q', 'text',
    'What currencies do you accept?',
    'en', 130),
  ('faq', 'faq7_a', 'richtext',
    'We accept Vanuatu Vatu (VUV), Australian Dollars (AUD), and New Zealand Dollars (NZD). On our website, you can use the currency selector at the top to view prices in your preferred currency.',
    'en', 140)

ON CONFLICT DO NOTHING;

-- ─── SITE SETTINGS ───────────────────────────────────────────────────────────
-- Seeds default values for all settings keys so the admin Settings tab
-- shows pre-filled values instead of empty fields.

INSERT INTO site_settings (key, value)
VALUES
  ('business_name',      '"Ace Tours & Transfers"'),
  ('contact_email',      '"acetoursvanuatu@outlook.com"'),
  ('contact_phone',      '"+678 7342389"'),
  ('contact_address',    '"Port Vila, Efate, Vanuatu"'),
  ('whatsapp_number',    '"+6787342389"'),
  ('whatsapp_greeting',  '"Hi! I would like to enquire about your tours and transfers."'),
  ('default_currency',   '"VUV"'),
  ('booking_terms',      '"Cancellations more than 48 hours in advance are fully refundable. Within 48 hours may incur a fee."'),
  ('cancellation_policy','"Full refund for cancellations more than 48 hours before service. 50% refund for 24-48 hours notice. No refund within 24 hours."'),
  ('social_instagram',   '"https://www.instagram.com/acetoursvanuatu/"'),
  ('social_facebook',    '"https://www.facebook.com/acetoursvanuatu"'),
  ('ga4_measurement_id', '""'),
  ('gtm_container_id',   '""')

ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value
  WHERE site_settings.value = '""' OR site_settings.value = 'null' OR site_settings.value IS NULL;

-- ─── OFFLINE PAYMENT INSTRUCTION DEFAULTS ───────────────────────────────────
INSERT INTO site_settings (key, value)
VALUES
  ('bank_transfer_account_name',   '"Ace Tours & Transfers"'),
  ('bank_transfer_account_number', '"To be configured"'),
  ('bank_transfer_bank_name',      '"BSP / ANZ / BRED"'),
  ('bank_transfer_reference_format', '"Use your Booking ID as the payment reference (e.g. ACT-XXXXXXXX)"'),
  ('cash_instructions',            '"Pay your driver in cash on the day of service. VUV preferred — please bring exact change."'),
  ('cash_accepted_currencies',     '"VUV, AUD, NZD"'),
  ('ewallet_phone_number',         '"+678 7342389"'),
  ('ewallet_reference_format',     '"Use your Booking ID as the payment reference"'),
  ('ewallet_instructions',         '"Screenshot your payment receipt and WhatsApp or email it to us for faster confirmation."')
ON CONFLICT (key) DO NOTHING;

-- ─── TERMS CONTENT BLOCK ─────────────────────────────────────────────────────
-- Register the 'terms' block in content_blocks so CMS works correctly.
INSERT INTO content_blocks (slug, label, description, enabled)
VALUES ('terms', 'Terms of Service', 'Terms and conditions page content', true)
ON CONFLICT DO NOTHING;

-- ─── FAQ CONTENT BLOCK ───────────────────────────────────────────────────────
INSERT INTO content_blocks (slug, label, description, enabled)
VALUES ('faq', 'FAQ Page', 'Frequently Asked Questions shown on the FAQ page', true)
ON CONFLICT DO NOTHING;
