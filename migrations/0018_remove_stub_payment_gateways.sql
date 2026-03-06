-- Migration: Remove stub/alias payment gateway rows that have no real implementation.
-- These were either duplicate aliases (anz, bsp, bred) or generic placeholders
-- (mastercard-gateway, generic-local-bank) that served no production purpose.
-- The canonical eGate slugs (anz-egate, bsp-bank, bred-bank) are kept.
-- Reassign any existing references from legacy slugs to their canonical counterparts before deletion
UPDATE payments
SET gateway_id = (
        SELECT id
        FROM payment_gateways
        WHERE slug = 'anz-egate'
    )
WHERE gateway_id IN (
        SELECT id
        FROM payment_gateways
        WHERE slug = 'anz'
    );
UPDATE payments
SET gateway_id = (
        SELECT id
        FROM payment_gateways
        WHERE slug = 'bsp-bank'
    )
WHERE gateway_id IN (
        SELECT id
        FROM payment_gateways
        WHERE slug = 'bsp'
    );
UPDATE payments
SET gateway_id = (
        SELECT id
        FROM payment_gateways
        WHERE slug = 'bred-bank'
    )
WHERE gateway_id IN (
        SELECT id
        FROM payment_gateways
        WHERE slug = 'bred'
    );
DELETE FROM payment_gateways
WHERE slug IN (
        'anz',
        'bsp',
        'bred',
        'mastercard-gateway',
        'generic-local-bank'
    );