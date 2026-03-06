-- Migration: Remove legacy bank transfer gateway aliases and ensure payment flags are enabled
-- These slugs were duplicate aliases for manual_transfer — the canonical bank transfer gateway.
-- Only manual_transfer (active=true, isDefault=true) and cash (active=true) should remain.
-- Reassign any existing references from legacy slugs to manual_transfer before deletion
UPDATE payments
SET gateway_id = (
    SELECT id
    FROM payment_gateways
    WHERE slug = 'manual_transfer'
  )
WHERE gateway_id IN (
    SELECT id
    FROM payment_gateways
    WHERE slug IN ('bank-transfer', 'bank_transfer', 'bank')
  );
DELETE FROM payment_gateways
WHERE slug IN ('bank-transfer', 'bank_transfer', 'bank');
-- Ensure the canonical bank transfer gateway is active and default
UPDATE payment_gateways
SET active = true,
  is_default = true
WHERE slug = 'manual_transfer';
-- Ensure feature flags for bank transfer and cash are enabled
-- (upsert: insert if missing, update if present)
INSERT INTO feature_flags (slug, enabled, display_name, description)
VALUES (
    'payment-bank-transfer',
    true,
    'Bank Transfer',
    'Enable manual bank transfer payment method'
  ),
  (
    'payment-cash-on-delivery',
    true,
    'Cash on Delivery',
    'Enable cash on delivery payment method'
  ) ON CONFLICT (slug) DO
UPDATE
SET enabled = true;