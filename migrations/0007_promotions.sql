CREATE TABLE IF NOT EXISTS promotions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text NOT NULL DEFAULT '',
    discount_type text NOT NULL DEFAULT 'percentage',
    discount_value integer NOT NULL DEFAULT 0,
    min_purchase_cents integer NOT NULL DEFAULT 0,
    max_uses integer NOT NULL DEFAULT 0,
    used_count integer NOT NULL DEFAULT 0,
    valid_from text NOT NULL,
    valid_to text NOT NULL,
    applicable_to text NOT NULL DEFAULT 'all',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(),
    created_by varchar REFERENCES users(id)
);