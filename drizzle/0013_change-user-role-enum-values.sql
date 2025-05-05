ALTER TABLE "public"."user_profile" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."userprofile_role_enum";--> statement-breakpoint
CREATE TYPE "public"."userprofile_role_enum" AS ENUM('admin', 'trainer', 'guest', 'client');--> statement-breakpoint
ALTER TABLE "public"."user_profile" ALTER COLUMN "role" SET DATA TYPE "public"."userprofile_role_enum" USING "role"::"public"."userprofile_role_enum";