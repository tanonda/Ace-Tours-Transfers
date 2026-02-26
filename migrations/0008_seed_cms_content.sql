-- ============================================================================
-- Migration: Seed CMS Content
-- Seeds every piece of hardcoded website text into the cms_content table.
-- After running this, ALL pages pull their text from the database via the
-- useCmsText() hook. The CMS admin "Currently Live" box will show real content.
--
-- Safe to re-run: ON CONFLICT DO NOTHING skips rows that already exist.
-- block_slug + content_key + locale is the logical unique key.
-- ============================================================================

-- ─── HOME PAGE ───────────────────────────────────────────────────────────────
-- Covers: hero headline, hero subtitle, about section, tours/transfers/CTA labels

INSERT INTO cms_content (block_slug, content_key, content_type, value, locale, sort_order)
VALUES
  ('home', 'hero_title_part1',   'text',
    'Time for your',
    'en', 10),

  ('home', 'hero_title_part2',   'text',
    'next adventure',
    'en', 20),

  ('home', 'hero_subtitle',      'text',
    'Discover the best of Efate Island with our curated experiences.',
    'en', 30),

  ('home', 'about_label',        'text',
    'About Us',
    'en', 40),

  ('home', 'about_title',        'text',
    'Travel made easy',
    'en', 50),

  ('home', 'about_desc1',        'text',
    'Welcome to Ace Tours & Transfers. Our mission is to offer meticulously pre-planned and custom-designed tour packages that ensure your stay in Port Vila is nothing short of extraordinary.',
    'en', 60),

  ('home', 'about_desc2',        'text',
    'Whether you''re seeking adventure, relaxation, or cultural immersion, we are dedicated to making your experience enjoyable, safe, and unforgettable. We are fully insured for public liability and take your safety to heart!',
    'en', 70),

  ('home', 'about_quote',        'text',
    'Customer satisfaction, safety, and service are at the heart of everything we do.',
    'en', 80),

  ('home', 'about_badge1',       'text', 'Fully Insured',           'en', 90),
  ('home', 'about_badge2',       'text', 'Experienced Drivers',     'en', 100),
  ('home', 'about_badge3',       'text', 'Custom Itineraries',      'en', 110),
  ('home', 'about_badge4',       'text', 'Safety First',            'en', 120),

  ('home', 'tours_label',        'text', 'Our Packages',            'en', 130),
  ('home', 'tours_title',        'text', 'Unforgettable Tours',     'en', 140),
  ('home', 'tours_desc',         'text',
    'Discover the best of Efate Island with our curated experiences.',
    'en', 150),

  ('home', 'transfers_label',    'text', 'Airport & Hotel',         'en', 160),
  ('home', 'transfers_title',    'text', 'Reliable Transfers',      'en', 170),
  ('home', 'transfers_desc',     'text',
    'Professional transport solutions for any occasion.',
    'en', 180),

  ('home', 'vehicles_label',     'text', 'Self-Drive',              'en', 185),
  ('home', 'vehicles_title',     'text', 'Vehicle Hire',            'en', 190),
  ('home', 'vehicles_desc',      'text',
    'Explore Vanuatu at your own pace with our reliable vehicle hire service.',
    'en', 195),

  ('home', 'cta_title',          'text',
    'Ready for your next adventure?',
    'en', 200),

  ('home', 'cta_desc',           'text',
    'Let us handle the details while you make the memories.',
    'en', 210),

  ('home', 'cta_button',         'text', 'Start Planning Now',      'en', 220),

  ('home', 'trust_licensed',     'text', 'Fully Licensed',          'en', 230),
  ('home', 'trust_licensed_desc','text', 'Official JTB Approved Operator', 'en', 231),
  ('home', 'trust_rated',        'text', 'Top Rated',               'en', 240),
  ('home', 'trust_rated_desc',   'text', '5-Star Service Guarantee','en', 241),
  ('home', 'trust_secure',       'text', 'Secure Booking',          'en', 250),
  ('home', 'trust_secure_desc',  'text', 'Instant Confirmation & Support', 'en', 251)

ON CONFLICT DO NOTHING;

-- ─── ABOUT PAGE ──────────────────────────────────────────────────────────────

INSERT INTO cms_content (block_slug, content_key, content_type, value, locale, sort_order)
VALUES
  ('about', 'page_title',          'text',
    'About Ace Tours',
    'en', 10),

  ('about', 'page_subtitle',       'text',
    'Your trusted partner for exploring the beautiful islands of Vanuatu.',
    'en', 20),

  ('about', 'story_title',         'text',
    'Our Story',
    'en', 30),

  ('about', 'story_desc1',         'text',
    'Ace Tours & Transfers was founded with a simple mission: to share the incredible beauty and culture of Vanuatu with the world. What started as a small family-owned business has grown into one of Port Vila''s most trusted tour operators.',
    'en', 40),

  ('about', 'story_desc2',         'text',
    'We pride ourselves on our deep local knowledge, professional service, and commitment to safety. Our team of experienced drivers and guides are passionate about making your visit unforgettable.',
    'en', 50),

  ('about', 'badge1',              'text', 'Locally Owned & Operated',  'en', 60),
  ('about', 'badge2',              'text', 'Fully Insured & Licensed',   'en', 70),
  ('about', 'badge3',              'text', 'Expert Local Guides',        'en', 80),
  ('about', 'badge4',              'text', 'Modern, Comfortable Fleet',  'en', 90),
  ('about', 'badge5',              'text', 'Customized Itineraries',     'en', 100),
  ('about', 'badge6',              'text', '24/7 Customer Support',      'en', 110),

  ('about', 'why_choose_us',       'text', 'Why Choose Us?',             'en', 120),

  ('about', 'feature1_title',      'text', 'Local Expertise',            'en', 130),
  ('about', 'feature1_desc',       'text',
    'We know every hidden gem, best photo spot, and authentic local experience on the island.',
    'en', 140),

  ('about', 'feature2_title',      'text', 'Reliable Service',           'en', 150),
  ('about', 'feature2_desc',       'text',
    'Punctuality and reliability are our hallmarks. You can count on us to be there when you need us.',
    'en', 160),

  ('about', 'feature3_title',      'text', 'Safety First',               'en', 170),
  ('about', 'feature3_desc',       'text',
    'Your safety is our priority. Our vehicles are regularly maintained and our drivers are professionally trained.',
    'en', 180)

ON CONFLICT DO NOTHING;

-- ─── CONTACT PAGE ────────────────────────────────────────────────────────────

INSERT INTO cms_content (block_slug, content_key, content_type, value, locale, sort_order)
VALUES
  ('contact', 'page_title',         'text', 'Contact Us',                   'en', 10),

  ('contact', 'page_subtitle',      'text',
    'Have questions? We''d love to hear from you.',
    'en', 20),

  ('contact', 'get_in_touch_desc',  'text',
    'Whether you want to book a tour, arrange a transfer, or just have a question about Vanuatu, our friendly team is here to help.',
    'en', 30),

  ('contact', 'phone_availability', 'text', 'Available 24/7 for emergencies',  'en', 40),
  ('contact', 'email_reply_time',   'text', 'We usually reply within 24 hours', 'en', 50),
  ('contact', 'office_hours',       'text', 'Office open Mon-Fri, 8am - 5pm',   'en', 60),
  ('contact', 'whatsapp_desc',      'text',
    'The fastest way to get answers, ask questions, or plan your tour. We typically reply within minutes.',
    'en', 70)

ON CONFLICT DO NOTHING;

-- ─── FOOTER ──────────────────────────────────────────────────────────────────

INSERT INTO cms_content (block_slug, content_key, content_type, value, locale, sort_order)
VALUES
  ('footer', 'description',  'text',
    'Experience the beauty of Efate Island with us. We offer meticulously pre-planned and custom-designed tour packages.',
    'en', 10),

  ('footer', 'copyright',    'text', 'All rights reserved.',   'en', 20)

ON CONFLICT DO NOTHING;
