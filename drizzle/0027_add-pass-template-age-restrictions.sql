CREATE TYPE "public"."pass_template_type_enum" AS ENUM('group', 'individual');--> statement-breakpoint
CREATE TABLE "pass_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"price" integer NOT NULL,
	"length" smallint NOT NULL,
	"type" "pass_template_type_enum" NOT NULL,
	"studio_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pass_template_age_restriction" (
	"id" serial PRIMARY KEY NOT NULL,
	"min_age" smallint,
	"max_age" smallint,
	"allowed_threshold" smallint,
	"pass_template_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pass_template_age_restriction_exception" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"pass_template_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "pass_template_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pass_template" ADD CONSTRAINT "pass_template_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_template_age_restriction" ADD CONSTRAINT "pass_template_age_restriction_pass_template_id_pass_template_id_fk" FOREIGN KEY ("pass_template_id") REFERENCES "public"."pass_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_template_age_restriction_exception" ADD CONSTRAINT "pass_template_age_restriction_exception_user_profile_id_user_profile_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_template_age_restriction_exception" ADD CONSTRAINT "pass_template_age_restriction_exception_pass_template_id_pass_template_id_fk" FOREIGN KEY ("pass_template_id") REFERENCES "public"."pass_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pass_template_studio_id_name_index" ON "pass_template" USING btree ("studio_id","name");--> statement-breakpoint
CREATE INDEX "pass_template_age_restriction_pass_template_id_index" ON "pass_template_age_restriction" USING btree ("pass_template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pass_template_age_restriction_exception_user_profile_id_pass_template_id_index" ON "pass_template_age_restriction_exception" USING btree ("user_profile_id","pass_template_id");--> statement-breakpoint
ALTER TABLE "pass" ADD CONSTRAINT "pass_pass_template_id_pass_template_id_fk" FOREIGN KEY ("pass_template_id") REFERENCES "public"."pass_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "pass" DROP COLUMN "length";