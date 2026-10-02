-- Migration 0023: drop "vehicle hire" from the homepage hero subtitle (all locales).
--
-- Vehicle hire was retired in 0021 (Vanuatu FIU compliance), but the CMS hero
-- subtitle still advertised it. Each UPDATE removes only the vehicle-hire
-- phrase and only matches the exact seeded text, so a subtitle an admin has
-- since edited in the CMS is left untouched. Safe to re-run.

UPDATE cms_content
SET value = 'Your trusted partner for premium airport transfers and unforgettable guided island tours in Port Vila.',
    updated_at = now()
WHERE block_slug = 'home-page' AND content_key = 'hero_subtitle' AND locale = 'en'
  AND value = 'Your trusted partner for premium airport transfers, reliable vehicle hire, and unforgettable guided island tours in Port Vila.';
--> statement-breakpoint
UPDATE cms_content
SET value = 'Votre partenaire de confiance pour des transferts aéroport haut de gamme et des visites guidées inoubliables de l''île de Port-Vila.',
    updated_at = now()
WHERE block_slug = 'home-page' AND content_key = 'hero_subtitle' AND locale = 'fr'
  AND value = 'Votre partenaire de confiance pour des transferts aéroport haut de gamme, une location de véhicules fiable et des visites guidées inoubliables de l''île de Port-Vila.';
--> statement-breakpoint
UPDATE cms_content
SET value = '您值得信赖的合作伙伴，为您提供优质机场接送以及令人难忘的维拉港导游岛屿之旅。',
    updated_at = now()
WHERE block_slug = 'home-page' AND content_key = 'hero_subtitle' AND locale = 'zh'
  AND value = '您值得信赖的合作伙伴，为您提供优质机场接送、可靠的车辆租赁以及令人难忘的维拉港导游岛屿之旅。';
--> statement-breakpoint
UPDATE cms_content
SET value = 'Su socio de confianza para traslados premium al aeropuerto y visitas guiadas inolvidables a la isla de Port Vila.',
    updated_at = now()
WHERE block_slug = 'home-page' AND content_key = 'hero_subtitle' AND locale = 'es'
  AND value = 'Su socio de confianza para traslados premium al aeropuerto, alquiler de vehículos confiable y visitas guiadas inolvidables a la isla de Port Vila.';
--> statement-breakpoint
UPDATE cms_content
SET value = 'Mifala i stretfala patna blong yu blong ol kwaeti transfe long epot, mo ol guided tura blong aelan long Port Vila we yu no save fogetem.',
    updated_at = now()
WHERE block_slug = 'home-page' AND content_key = 'hero_subtitle' AND locale = 'bi'
  AND value = 'Mifala i stretfala patna blong yu blong ol kwaeti transfe long epot, rentekama blong raon, mo ol guided tura blong aelan long Port Vila we yu no save fogetem.';
