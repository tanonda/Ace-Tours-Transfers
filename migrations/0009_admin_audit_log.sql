-- Admin action audit log: tracks sensitive admin mutations for compliance / paper trail
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "action" text NOT NULL,
    "entity_type" text NOT NULL,
    "entity_id" text,
    "entity_name" text,
    "performed_by" text,
    "previous_value" jsonb,
    "new_value" jsonb,
    "ip_address" text,
    "user_agent" text,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_admin_audit_action" ON "admin_audit_log" USING btree ("action");
--> statement-breakpoint
CREATE INDEX "idx_admin_audit_entity" ON "admin_audit_log" USING btree ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX "idx_admin_audit_created_at" ON "admin_audit_log" USING btree ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX "idx_admin_audit_performed_by" ON "admin_audit_log" USING btree ("performed_by");