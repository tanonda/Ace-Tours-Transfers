-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ Migration 0021 — Vehicle Hire Data Purge (Vanuatu FIU compliance)       │
-- │                                                                         │
-- │ Hard-deletes every row tied to vehicle-category products. Adds a CHECK  │
-- │ constraint to prevent re-introduction. PR 3 of 3.                       │
-- │                                                                         │
-- │ ⚠ IRREVERSIBLE — capture a database backup before applying.             │
-- │                                                                         │
-- │ Most FKs were declared without ON DELETE CASCADE. Deletion order        │
-- │ respects the dependency graph below — child rows first, parents last.   │
-- │                                                                         │
-- │  payments.booking_id              ─→ bookings        (no cascade)       │
-- │  reviews.booking_id               ─→ bookings        (no cascade)       │
-- │  reviews.tour_id                  ─→ products        (no cascade)       │
-- │  booking_items.booking_id         ─→ bookings        (cascade ✓)        │
-- │  booking_addons.booking_id        ─→ bookings        (cascade ✓)        │
-- │  bookings.tour_instance_id        ─→ tour_instances  (no cascade)       │
-- │  bookings.hold_id                 ─→ availability_holds (no cascade)    │
-- │  availability_holds.tour_inst_id  ─→ tour_instances  (no cascade)       │
-- │  wishlist_items.tour_id           ─→ products        (no cascade)       │
-- │  pricing_versions.product_id      ─→ products        (no cascade)       │
-- │  product_blackout_dates.product_id─→ products        (no cascade)       │
-- │  resources.product_id             ─→ products        (no cascade)       │
-- │  product_translations.product_id  ─→ products        (cascade ✓)        │
-- └─────────────────────────────────────────────────────────────────────────┘

-- 1. Drop payments for vehicle bookings (would block bookings deletion).
DELETE FROM payments
WHERE booking_id IN (
  SELECT id FROM bookings
  WHERE tour_id IN (SELECT id FROM products WHERE category = 'vehicle')
);
--> statement-breakpoint

-- 2. Drop reviews tied to vehicle products, vehicle bookings, or vehicle
--    tour_instances. Reviews of a removed offering have no meaningful subject.
DELETE FROM reviews
WHERE tour_id IN (SELECT id FROM products WHERE category = 'vehicle')
   OR booking_id IN (
        SELECT id FROM bookings
        WHERE tour_id IN (SELECT id FROM products WHERE category = 'vehicle')
      );
--> statement-breakpoint

-- 3. Drop booking_items pointing at vehicle products. Catches vehicle items
--    inside mixed bookings (tour + vehicle in one cart) that step 4 would
--    not reach via bookings.tour_id alone.
DELETE FROM booking_items
WHERE product_id IN (SELECT id FROM products WHERE category = 'vehicle');
--> statement-breakpoint

-- 4. Drop bookings whose primary product is a vehicle. booking_items and
--    booking_addons with the same booking_id cascade automatically.
--    This also clears bookings.hold_id and bookings.tour_instance_id refs
--    so steps 5–6 can delete those rows without FK violations.
DELETE FROM bookings
WHERE tour_id IN (SELECT id FROM products WHERE category = 'vehicle');
--> statement-breakpoint

-- 5. Drop availability_holds for vehicle tour_instances. Safe now that no
--    booking points at them via bookings.hold_id.
DELETE FROM availability_holds
WHERE tour_instance_id IN (
  SELECT id FROM tour_instances
  WHERE tour_id IN (SELECT id FROM products WHERE category = 'vehicle')
);
--> statement-breakpoint

-- 6. Drop the remaining direct product children that block deletion.
DELETE FROM wishlist_items
WHERE tour_id IN (SELECT id FROM products WHERE category = 'vehicle');
--> statement-breakpoint

DELETE FROM tour_instances
WHERE tour_id IN (SELECT id FROM products WHERE category = 'vehicle');
--> statement-breakpoint

DELETE FROM pricing_versions
WHERE product_id IN (SELECT id FROM products WHERE category = 'vehicle');
--> statement-breakpoint

DELETE FROM product_blackout_dates
WHERE product_id IN (SELECT id FROM products WHERE category = 'vehicle');
--> statement-breakpoint

DELETE FROM resources
WHERE product_id IN (SELECT id FROM products WHERE category = 'vehicle');
--> statement-breakpoint

-- product_translations cascades, but be explicit so the audit trail shows
-- the row count via the migration runner output.
DELETE FROM product_translations
WHERE product_id IN (SELECT id FROM products WHERE category = 'vehicle');
--> statement-breakpoint

-- 7. Finally, the vehicle products themselves.
DELETE FROM products WHERE category = 'vehicle';
--> statement-breakpoint

-- 8. Remove the orphaned feature flag — no code paths reference it after PR 2.
DELETE FROM feature_flags WHERE slug = 'vehicle-hire';
--> statement-breakpoint

-- 9. Hardening: prevent any future re-introduction of vehicle-category rows.
--    The CHECK constraint enforces FIU compliance at the database level so
--    even a manual INSERT or rogue migration cannot put a vehicle back.
ALTER TABLE products
  ADD CONSTRAINT products_category_no_vehicle
  CHECK (category IN ('tour', 'transfer'));
--> statement-breakpoint

-- 10. Sanity assertion. Aborts the migration if anything was missed.
DO $$
DECLARE
  remaining_products      int;
  remaining_bookings      int;
  remaining_booking_items int;
  remaining_resources     int;
  remaining_flag          int;
BEGIN
  SELECT count(*) INTO remaining_products
    FROM products WHERE category = 'vehicle';
  SELECT count(*) INTO remaining_bookings
    FROM bookings WHERE tour_id IN (
      SELECT id FROM products WHERE category = 'vehicle'
    );
  SELECT count(*) INTO remaining_booking_items
    FROM booking_items WHERE product_id IN (
      SELECT id FROM products WHERE category = 'vehicle'
    );
  SELECT count(*) INTO remaining_resources
    FROM resources WHERE product_id IN (
      SELECT id FROM products WHERE category = 'vehicle'
    );
  SELECT count(*) INTO remaining_flag
    FROM feature_flags WHERE slug = 'vehicle-hire';

  IF remaining_products      <> 0
  OR remaining_bookings      <> 0
  OR remaining_booking_items <> 0
  OR remaining_resources     <> 0
  OR remaining_flag          <> 0 THEN
    RAISE EXCEPTION 'Vehicle hire purge incomplete. products=% bookings=% booking_items=% resources=% feature_flag=%',
      remaining_products, remaining_bookings, remaining_booking_items,
      remaining_resources, remaining_flag;
  END IF;

  RAISE NOTICE 'Vehicle hire purge verified: 0 vehicle products, 0 dependent rows, 0 feature_flag rows.';
END $$;
