
-- Remove the columns first
ALTER TABLE "pass" DROP COLUMN IF EXISTS "paused_from_date";
ALTER TABLE "pass" DROP COLUMN IF EXISTS "paused_to_date";
ALTER TABLE "pass" DROP COLUMN IF EXISTS "expired_from_date";

-- Update enum types
ALTER TABLE "public"."pass" ALTER COLUMN "status" SET DATA TYPE text;
DROP TYPE IF EXISTS "public"."pass_status_enum";
CREATE TYPE "public"."pass_status_enum" AS ENUM('active', 'expired');
ALTER TABLE "public"."pass" ALTER COLUMN "status" SET DATA TYPE "public"."pass_status_enum" USING "status"::"public"."pass_status_enum";

ALTER TABLE "public"."training_signup" ALTER COLUMN "status" SET DATA TYPE text;
DROP TYPE IF EXISTS "public"."training_signup_status_enum";
CREATE TYPE "public"."training_signup_status_enum" AS ENUM('active', 'canceled', 'archived');
ALTER TABLE "public"."training_signup" ALTER COLUMN "status" SET DATA TYPE "public"."training_signup_status_enum" USING "status"::"public"."training_signup_status_enum";

-- Now create the unique index (after enum types are fixed)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_pass_per_client" ON "pass" USING btree ("client_id") WHERE "pass"."status" = 'active';
