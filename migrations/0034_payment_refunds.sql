-- BRED/PayZen refunds are executed in the bank's Back Office and reported back
-- as CREDIT notifications. Record what was refunded so admins, receipts and
-- reports are not blind to money returned to the guest. Amounts are whole VUV,
-- the same unit as payments.amount.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_amount" integer NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_at" timestamp;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_reference" text;
