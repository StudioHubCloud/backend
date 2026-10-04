ALTER TABLE "personal_training_signup" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD COLUMN "studio_price_id" uuid;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD COLUMN "participants_note" varchar(500);--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD COLUMN "price" integer;--> statement-breakpoint
-- Backfill existing rows (all are pass sessions): one session's price = pass price / pass length.
UPDATE "personal_training_signup" pts
SET "price" = round(pt."price"::numeric / pt."length")
FROM "pass" p
JOIN "pass_template" pt ON pt."id" = p."pass_template_id"
WHERE p."id" = pts."pass_id" AND pts."price" IS NULL;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ALTER COLUMN "price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD COLUMN "staff_member_payout_id" uuid;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD CONSTRAINT "personal_training_signup_studio_price_id_studio_price_id_fk" FOREIGN KEY ("studio_price_id") REFERENCES "public"."studio_price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD CONSTRAINT "personal_training_signup_staff_member_payout_id_staff_member_payout_id_fk" FOREIGN KEY ("staff_member_payout_id") REFERENCES "public"."staff_member_payout"("id") ON DELETE set null ON UPDATE no action;