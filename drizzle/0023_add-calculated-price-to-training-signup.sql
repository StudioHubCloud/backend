ALTER TABLE "training_signup" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "training_signup" ADD COLUMN "calculated_price" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "training_signup" ADD CONSTRAINT "training_signup_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE set null ON UPDATE no action;