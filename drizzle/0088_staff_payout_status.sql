CREATE TYPE "public"."staff_member_payout_status_enum" AS ENUM('pending', 'paid');--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'staff_payout_approve';--> statement-breakpoint
ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'staff_payout_cancel';--> statement-breakpoint
ALTER TYPE "public"."audit_log_entity_enum" ADD VALUE 'staff_member_payout';--> statement-breakpoint
ALTER TABLE "staff_member_payout" ADD COLUMN "status" "staff_member_payout_status_enum" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_member_payout" ADD COLUMN "snapshot" jsonb;