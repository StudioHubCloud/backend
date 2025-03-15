UPDATE "customer" SET "telegram_id" = NULL WHERE "telegram_id" = '';--> statement-breakpoint
UPDATE "user_profile" SET "telegram_id" = NULL WHERE "telegram_id" = '';--> statement-breakpoint

ALTER TABLE "customer" ALTER COLUMN "email_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ALTER COLUMN "telegram_id" SET DATA TYPE smallint USING "telegram_id"::smallint;--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "full_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "phone_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "telegram_id" SET DATA TYPE smallint USING "telegram_id"::smallint;