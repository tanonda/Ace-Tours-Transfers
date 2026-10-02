-- Migration 0024: Hospitality Package is a flat VT 25,000 package for up to 15 people.
--
-- The product is already group-priced (pricing_type = 'group',
-- group_price_cents = 25000) but had no group cap, so the transfer page showed
-- the package rate without "up to N people". Only fills the cap when it is
-- still unset and the price is still the agreed VT 25,000, so later admin edits
-- are left alone. Safe to re-run.

UPDATE products
SET group_max_pax = 15
WHERE id = '43297acd-0608-42bc-bb54-d2f32c97e014'
  AND pricing_type = 'group'
  AND group_price_cents = 25000
  AND group_max_pax IS NULL;
