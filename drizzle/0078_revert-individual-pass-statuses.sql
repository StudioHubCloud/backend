ALTER TABLE "pass" DROP CONSTRAINT "pass_staff_member_id_staff_member_id_fk";
--> statement-breakpoint
ALTER TABLE "personal_training_signup" DROP CONSTRAINT "personal_training_signup_staff_member_payout_id_staff_member_payout_id_fk";
--> statement-breakpoint
ALTER TABLE "pass" DROP COLUMN "staff_member_id";--> statement-breakpoint
ALTER TABLE "personal_training_signup" DROP COLUMN "client_note";--> statement-breakpoint
ALTER TABLE "personal_training_signup" DROP COLUMN "staff_member_payout_id";--> statement-breakpoint
ALTER TABLE "personal_training_signup" DROP COLUMN "resolved_at";--> statement-breakpoint
ALTER TABLE "personal_training_signup" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "personal_training_signup" DROP COLUMN "reminder_sent_at";--> statement-breakpoint
ALTER TABLE "public"."audit_log" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."audit_log_actions_enum";--> statement-breakpoint
CREATE TYPE "public"."audit_log_actions_enum" AS ENUM('pass_edit', 'pass_create', 'pass_reminder_sent', 'client_verify_confirm', 'pass_activate_confirm', 'pass_activate_reject', 'pass_activate_request', 'training_signup_create', 'training_signup_cancel', 'training_signup_status_change', 'expire_past_passes', 'activate_passes_after_grace_period', 'ai_assistant_action', 'personal_training_register', 'personal_training_cancel');--> statement-breakpoint
ALTER TABLE "public"."audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."audit_log_actions_enum" USING "action"::"public"."audit_log_actions_enum";--> statement-breakpoint
-- Hand-reordered: default and partial index must be dropped before the enum swap and recreated after it.
DROP INDEX "unique_open_personal_training_slot";--> statement-breakpoint
ALTER TABLE "personal_training_signup" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."personal_training_signup" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."personal_training_signup_status_enum";--> statement-breakpoint
CREATE TYPE "public"."personal_training_signup_status_enum" AS ENUM('scheduled', 'canceled');--> statement-breakpoint
ALTER TABLE "public"."personal_training_signup" ALTER COLUMN "status" SET DATA TYPE "public"."personal_training_signup_status_enum" USING "status"::"public"."personal_training_signup_status_enum";--> statement-breakpoint
ALTER TABLE "personal_training_signup" ALTER COLUMN "status" SET DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_open_personal_training_slot" ON "personal_training_signup" USING btree ("client_id","scheduled_at") WHERE "personal_training_signup"."status" = 'scheduled';--> statement-breakpoint
ALTER TABLE "public"."studio_payout_rule" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."studio_payout_rule_type_enum";--> statement-breakpoint
CREATE TYPE "public"."studio_payout_rule_type_enum" AS ENUM('fixed', 'percentage', 'per_signup');--> statement-breakpoint
ALTER TABLE "public"."studio_payout_rule" ALTER COLUMN "type" SET DATA TYPE "public"."studio_payout_rule_type_enum" USING "type"::"public"."studio_payout_rule_type_enum";