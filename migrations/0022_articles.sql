-- Migration 0022: Articles (blog / content engine)
-- A standalone table for SEO blog posts. Mirrors the products SEO pattern.
CREATE TABLE IF NOT EXISTS articles (
  id                   varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,
  title                text NOT NULL,
  excerpt              text,
  body_html            text NOT NULL,
  cover_image          text,
  image_alt            text,
  author               text,
  tags                 text[] NOT NULL DEFAULT '{}'::text[],
  related_product_ids  text[] NOT NULL DEFAULT '{}'::text[],
  status               text NOT NULL DEFAULT 'draft',
  published_at         timestamp,
  seo_title            text,
  seo_description      text,
  seo_keywords         text,
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_status_published_at
  ON articles (status, published_at DESC);
