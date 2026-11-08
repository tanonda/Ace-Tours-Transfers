-- ─────────────────────────────────────────────────────────────────────────────
-- cms_content: (block_slug, content_key, locale) is the logical key, but no
-- constraint enforced it. Re-seeding or a concurrent save could duplicate rows.
-- Keep the newest row per key, then create a COALESCE-based unique index (locale
-- is nullable, and NULLs are distinct in a plain unique index).
-- ─────────────────────────────────────────────────────────────────────────────
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY block_slug, content_key, COALESCE(locale, 'en')
           ORDER BY updated_at DESC, id DESC
         ) AS rn
  FROM cms_content
)
DELETE FROM cms_content c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_content_key_locale
  ON cms_content (block_slug, content_key, COALESCE(locale, 'en'));
