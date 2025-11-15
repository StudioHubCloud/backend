ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'pass_edit' BEFORE 'training_signup_create';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'pass_reminder_sent' BEFORE 'training_signup_create';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'client_verify_confirm' BEFORE 'training_signup_create';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'pass_activate_confirm' BEFORE 'training_signup_create';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'pass_activate_reject' BEFORE 'training_signup_create';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'pass_activate_request' BEFORE 'training_signup_create';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'expire_past_passes';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'activate_passes_after_grace_period';--> statement-breakpoint
ALTER TYPE "public"."audit_log_entity_enum" ADD VALUE 'pass_activation_request' BEFORE 'client';--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "telegram_id" DROP NOT NULL;