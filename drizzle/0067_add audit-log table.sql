CREATE TYPE "public"."audit_log_actions_enum" AS ENUM('pass_activation', 'pass_activation_auto', 'pass_renewal', 'pass_expiration', 'pass_status_change', 'pass_creation', 'pass_deletion', 'training_signup', 'training_cancellation', 'training_creation', 'training_update', 'payment_received', 'payment_refund', 'client_registration', 'client_update', 'client_status_change');--> statement-breakpoint
CREATE TYPE "public"."audit_log_operation_enum" AS ENUM('CREATE', 'UPDATE', 'DELETE');--> statement-breakpoint
CREATE TYPE "public"."audit_log_trigger_enum" AS ENUM('telegram_command', 'scheduled_task', 'cascade', 'admin_action', 'system', 'api');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"service_name" varchar NOT NULL,
	"method_name" varchar NOT NULL,
	"action" "audit_log_actions_enum" NOT NULL,
	"entity_name" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"operation" "audit_log_operation_enum" NOT NULL,
	"telegram_id" varchar,
	"user_role" varchar,
	"trigger" "audit_log_trigger_enum" NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"changed_fields" jsonb,
	"metadata" jsonb,
	"studio_id" uuid NOT NULL,
	"execution_time_ms" integer
);
--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_name","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_studio_idx" ON "audit_log" USING btree ("studio_id");