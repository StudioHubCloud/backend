CREATE TYPE "public"."pass_group_mode_enum" AS ENUM('fixed', 'flex');--> statement-breakpoint
DROP INDEX "unique_active_pass_per_client";--> statement-breakpoint
ALTER TABLE "user_register_request" ALTER COLUMN "file_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_register_request" ALTER COLUMN "fileType" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "current_pass_id" uuid;--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "group_mode" "pass_group_mode_enum" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "pass_template" ADD COLUMN "group_mode" "pass_group_mode_enum" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_register_request" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_current_pass_id_pass_id_fk" FOREIGN KEY ("current_pass_id") REFERENCES "public"."pass"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_register_request" ADD CONSTRAINT "user_register_request_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE set null ON UPDATE no action;