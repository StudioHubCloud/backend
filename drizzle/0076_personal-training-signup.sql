CREATE TYPE "public"."personal_training_signup_status_enum" AS ENUM('pending', 'confirmed', 'rejected', 'done', 'canceled');--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'personal_training_request';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'personal_training_confirm';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'personal_training_reject';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'personal_training_complete';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'personal_training_cancel';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'personal_training_reminder_sent';--> statement-breakpoint
ALTER TYPE "public"."audit_log_entity_enum" ADD VALUE 'personal_training_signup';--> statement-breakpoint
ALTER TYPE "public"."studio_payout_rule_type_enum" ADD VALUE 'personal_training';--> statement-breakpoint
CREATE TABLE "personal_training_signup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "personal_training_signup_status_enum" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"client_note" text,
	"pass_id" uuid,
	"client_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"studio_id" uuid NOT NULL,
	"staff_member_payout_id" uuid,
	"resolved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "staff_member_id" uuid;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD CONSTRAINT "personal_training_signup_pass_id_pass_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."pass"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD CONSTRAINT "personal_training_signup_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD CONSTRAINT "personal_training_signup_staff_member_id_staff_member_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD CONSTRAINT "personal_training_signup_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD CONSTRAINT "personal_training_signup_staff_member_payout_id_staff_member_payout_id_fk" FOREIGN KEY ("staff_member_payout_id") REFERENCES "public"."staff_member_payout"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_training_signup_client_id_status_index" ON "personal_training_signup" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "personal_training_signup_staff_member_id_status_index" ON "personal_training_signup" USING btree ("staff_member_id","status");--> statement-breakpoint
CREATE INDEX "personal_training_signup_studio_id_status_scheduled_at_index" ON "personal_training_signup" USING btree ("studio_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "personal_training_signup_pass_id_index" ON "personal_training_signup" USING btree ("pass_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_open_personal_training_slot" ON "personal_training_signup" USING btree ("client_id","scheduled_at") WHERE "personal_training_signup"."status" in ('pending','confirmed');--> statement-breakpoint
ALTER TABLE "pass" ADD CONSTRAINT "pass_staff_member_id_staff_member_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_member"("id") ON DELETE set null ON UPDATE no action;