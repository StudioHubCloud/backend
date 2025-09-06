ALTER TABLE "group_age_restriction_exception" ALTER COLUMN "group_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "group_age_restriction" ALTER COLUMN "group_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "group_schedule" ALTER COLUMN "group_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "group" ALTER COLUMN "id" SET DATA TYPE integer;
ALTER TABLE "pass" ALTER COLUMN "group_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "training" ALTER COLUMN "group_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "training_signup" ALTER COLUMN "group_id" SET DATA TYPE integer;