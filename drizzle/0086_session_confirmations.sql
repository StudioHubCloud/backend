ALTER TYPE "public"."personal_training_signup_status_enum" ADD VALUE 'completed';--> statement-breakpoint
ALTER TYPE "public"."personal_training_signup_status_enum" ADD VALUE 'no_show';--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD COLUMN "confirmed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "training_signup" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_signup" ADD COLUMN "confirmed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "personal_training_signup" ADD CONSTRAINT "personal_training_signup_confirmed_by_id_user_profile_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."user_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_signup" ADD CONSTRAINT "training_signup_confirmed_by_id_user_profile_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."user_profile"("id") ON DELETE set null ON UPDATE no action;