ALTER TYPE "public"."userprofile_status_enum" ADD VALUE 'unverified';--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "full_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "first_name" varchar DEFAULT 'unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "last_name" varchar;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "first_name" varchar DEFAULT 'unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "last_name" varchar;