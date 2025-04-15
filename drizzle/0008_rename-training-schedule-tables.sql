CREATE TYPE "public"."group_status_enum" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TYPE "public"."training_status_enum" RENAME TO "training_signup_status_enum";--> statement-breakpoint
ALTER TYPE "public"."training_type_enum" RENAME TO "training_signup_type_enum";--> statement-breakpoint
ALTER TYPE "public"."training_signup_status_enum" ADD VALUE 'archived';--> statement-breakpoint
CREATE TABLE "group_age_restriction_exception" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"group_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_age_restriction" (
	"id" serial PRIMARY KEY NOT NULL,
	"min_age" smallint,
	"max_age" smallint,
	"allowed_threshold" smallint,
	"group_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_schedule" RENAME TO "training_signup";--> statement-breakpoint
ALTER TABLE "training_signup" DROP CONSTRAINT "training_schedule_user_profile_id_user_profile_id_fk";
--> statement-breakpoint
ALTER TABLE "training_signup" DROP CONSTRAINT "training_schedule_pass_id_pass_id_fk";
--> statement-breakpoint
ALTER TABLE "training_signup" DROP CONSTRAINT "training_schedule_training_id_training_id_fk";
--> statement-breakpoint
DROP INDEX "[group]studioId_index";--> statement-breakpoint
DROP INDEX "[group]staffMemberId_index";--> statement-breakpoint
DROP INDEX "[training_schedule]userProfileId_index";--> statement-breakpoint
DROP INDEX "[training_schedule]passId_index";--> statement-breakpoint
DROP INDEX "[training_schedule]trainingId_index";--> statement-breakpoint
DROP INDEX "[training_schedule]trainingId-status-type_index";--> statement-breakpoint
DROP INDEX "[training_schedule]userProfileId-status-type_index";--> statement-breakpoint
DROP INDEX "[training_schedule]passId-status-type_index";--> statement-breakpoint
DROP INDEX "[training_schedule]trainingId-userProfileId_uindex";--> statement-breakpoint
DROP INDEX "[training_schedule]trainingId-passId_uindex";--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "status" "group_status_enum" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "group_age_restriction_exception" ADD CONSTRAINT "group_age_restriction_exception_user_profile_id_user_profile_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_age_restriction_exception" ADD CONSTRAINT "group_age_restriction_exception_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_age_restriction" ADD CONSTRAINT "group_age_restriction_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "[group_age_restriction]userProfileId-groupId_uindex" ON "group_age_restriction_exception" USING btree ("user_profile_id","group_id");--> statement-breakpoint
CREATE INDEX "groupId_index" ON "group_age_restriction" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "training_signup" ADD CONSTRAINT "training_signup_user_profile_id_user_profile_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_signup" ADD CONSTRAINT "training_signup_pass_id_pass_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."pass"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_signup" ADD CONSTRAINT "training_signup_training_id_training_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."training"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "[group]studioId-status_index" ON "group" USING btree ("studio_id","status");--> statement-breakpoint
CREATE INDEX "[group]staffMemberId-status_index" ON "group" USING btree ("staff_member_id","status");--> statement-breakpoint
CREATE INDEX "[training_signup]userProfileId_index" ON "training_signup" USING btree ("user_profile_id");--> statement-breakpoint
CREATE INDEX "[training_signup]passId_index" ON "training_signup" USING btree ("pass_id");--> statement-breakpoint
CREATE INDEX "[training_signup]trainingId_index" ON "training_signup" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX "[training_signup]trainingId-status-type_index" ON "training_signup" USING btree ("training_id","status","type");--> statement-breakpoint
CREATE INDEX "[training_signup]userProfileId-status-type_index" ON "training_signup" USING btree ("user_profile_id","status","type");--> statement-breakpoint
CREATE INDEX "[training_signup]passId-status-type_index" ON "training_signup" USING btree ("pass_id","status","type");--> statement-breakpoint
CREATE UNIQUE INDEX "[training_signup]trainingId-userProfileId_uindex" ON "training_signup" USING btree ("training_id","user_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "[training_signup]trainingId-passId_uindex" ON "training_signup" USING btree ("training_id","pass_id");--> statement-breakpoint
ALTER TABLE "group" DROP COLUMN "min_age_requirement";--> statement-breakpoint
ALTER TABLE "public"."user_profile" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."userprofile_status_enum";--> statement-breakpoint
CREATE TYPE "public"."userprofile_status_enum" AS ENUM('active', 'inactive', 'blocked');--> statement-breakpoint
ALTER TABLE "public"."user_profile" ALTER COLUMN "status" SET DATA TYPE "public"."userprofile_status_enum" USING "status"::"public"."userprofile_status_enum";