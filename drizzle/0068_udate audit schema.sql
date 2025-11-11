CREATE TYPE "public"."audit_log_entity_enum" AS ENUM('payment', 'training_signup', 'training', 'group', 'pass', 'client', 'user_profile');--> statement-breakpoint
ALTER TABLE "audit_log" RENAME COLUMN "entity_name" TO "entity";--> statement-breakpoint
ALTER TABLE "audit_log" RENAME COLUMN "execution_time_ms" TO "action_response_time_ms";--> statement-breakpoint
DROP INDEX "audit_log_entity_idx";--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "entity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "operation" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "telegram_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "trigger" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "action_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "payload" jsonb;--> statement-breakpoint
CREATE INDEX "audit_log_action_id_idx" ON "audit_log" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "service_name";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "method_name";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "user_role";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "old_value";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "new_value";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "changed_fields";--> statement-breakpoint
ALTER TABLE "public"."audit_log" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."audit_log_actions_enum";--> statement-breakpoint
CREATE TYPE "public"."audit_log_actions_enum" AS ENUM('training_signup_create', 'training_signup_cancel', 'training_signup_status_change');--> statement-breakpoint
ALTER TABLE "public"."audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."audit_log_actions_enum" USING "action"::"public"."audit_log_actions_enum";--> statement-breakpoint
ALTER TABLE "public"."audit_log" ALTER COLUMN "trigger" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."audit_log_trigger_enum";--> statement-breakpoint
CREATE TYPE "public"."audit_log_trigger_enum" AS ENUM('scheduled_task', 'admin_action', 'client_action', 'system');--> statement-breakpoint
ALTER TABLE "public"."audit_log" ALTER COLUMN "trigger" SET DATA TYPE "public"."audit_log_trigger_enum" USING "trigger"::"public"."audit_log_trigger_enum";