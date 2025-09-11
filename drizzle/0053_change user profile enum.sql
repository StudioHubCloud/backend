ALTER TABLE "public"."user_profile" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."userprofile_status_enum";--> statement-breakpoint
CREATE TYPE "public"."userprofile_status_enum" AS ENUM('active', 'archived', 'blocked', 'unverified', 'verification_requested');--> statement-breakpoint
ALTER TABLE "public"."user_profile" ALTER COLUMN "status" SET DATA TYPE "public"."userprofile_status_enum" USING "status"::"public"."userprofile_status_enum";