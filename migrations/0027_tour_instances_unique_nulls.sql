-- ─────────────────────────────────────────────────────────────────────────────
-- tour_instances: make "one instance per product/date/slot/time" actually true.
--
-- The old unique index included nullable columns (time_slot, start_time,
-- end_time). PostgreSQL treats NULLs as distinct, so full-day products (all
-- three NULL) could be inserted again and again, splitting capacity across
-- duplicate pools. The application now also takes a transaction-scoped advisory
-- lock, but the index is the durable guarantee.
--
-- If an installation already has duplicate rows, creating the index fails. The
-- DO block catches that and leaves a WARNING instead of aborting a deploy; run
-- scripts/dedupe-tour-instances.ts and re-run this migration.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_instances_unique_v2
      ON tour_instances (
        tour_id,
        service_date,
        COALESCE(time_slot, ''),
        COALESCE(start_time, ''),
        COALESCE(end_time, '')
      );
  EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'tour_instances has duplicate product/date/slot rows; unique index idx_tour_instances_unique_v2 was not created. Run scripts/dedupe-tour-instances.ts, then re-run this migration.';
  END;
END $$;
