ALTER TABLE "training_signup" DROP CONSTRAINT "training_signup_group_id_group_id_fk";
--> statement-breakpoint
ALTER TABLE "training_signup" ALTER COLUMN "group_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "available_slots" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "training_signup" ADD CONSTRAINT "training_signup_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."training_signup" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."training_signup_type_enum";--> statement-breakpoint
CREATE TYPE "public"."training_signup_type_enum" AS ENUM('main', 'reserve', 'trial');--> statement-breakpoint
ALTER TABLE "public"."training_signup" ALTER COLUMN "type" SET DATA TYPE "public"."training_signup_type_enum" USING "type"::"public"."training_signup_type_enum";