ALTER TABLE "business" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "business" CASCADE;--> statement-breakpoint
ALTER TABLE "group_schedule_day" DROP CONSTRAINT "[group_schedule_day]dayIndex_check";--> statement-breakpoint
--ALTER TABLE "studio" DROP CONSTRAINT "studio_business_id_business_id_fk";
--> statement-breakpoint
-->ALTER TABLE "user_profile" DROP CONSTRAINT "user_profile_business_id_business_id_fk";
--> statement-breakpoint
DROP INDEX "[customer]emailAddress_uindex";--> statement-breakpoint
DROP INDEX "[customer]telegramId_uindex";--> statement-breakpoint
DROP INDEX "[group_age_restriction]userProfileId-groupId_uindex";--> statement-breakpoint
DROP INDEX "groupId_index";--> statement-breakpoint
DROP INDEX "[group_schedule]time_groupId_day_uindex";--> statement-breakpoint
DROP INDEX "title_index";--> statement-breakpoint
DROP INDEX "[group_style_variant]studioId-groupStyleId_index";--> statement-breakpoint
DROP INDEX "[group_style_variant]groupStyleId-title_uindex";--> statement-breakpoint
DROP INDEX "studioId_index";--> statement-breakpoint
DROP INDEX "[group_style]studioId-title_uindex";--> statement-breakpoint
DROP INDEX "[group]studioId-status_index";--> statement-breakpoint
DROP INDEX "[group]staffMemberId-status_index";--> statement-breakpoint
DROP INDEX "[group]studioId-groupStyleId_uindex";--> statement-breakpoint
DROP INDEX "[group]studioId-staffMemberId_uindex";--> statement-breakpoint
DROP INDEX "[pass]groupId_index";--> statement-breakpoint
DROP INDEX "[pass]clientId_index";--> statement-breakpoint
DROP INDEX "[pass]groupId-status_index";--> statement-breakpoint
DROP INDEX "[pass]clientId-status_index";--> statement-breakpoint
DROP INDEX "[studio]businessId_index";--> statement-breakpoint
DROP INDEX "[subscribtion]customerId_uindex";--> statement-breakpoint
DROP INDEX "[subscribtion]subscribtionPlanId_index";--> statement-breakpoint
DROP INDEX "[subscribtion]customerId-status_index";--> statement-breakpoint
DROP INDEX "[subscribtion_plan]tier_uindex";--> statement-breakpoint
DROP INDEX "[subscribtion_plan]currencyCode3_uindex";--> statement-breakpoint
DROP INDEX "[training]date_groupId_trainerId_uindex";--> statement-breakpoint
DROP INDEX "[training]groupId_index";--> statement-breakpoint
DROP INDEX "[training]trainerId_index";--> statement-breakpoint
DROP INDEX "[training]date-isCancelled_index";--> statement-breakpoint
DROP INDEX "[training]isCancelled(true)_index";--> statement-breakpoint
DROP INDEX "[training_signup]userProfileId_index";--> statement-breakpoint
DROP INDEX "[training_signup]passId_index";--> statement-breakpoint
DROP INDEX "[training_signup]trainingId_index";--> statement-breakpoint
DROP INDEX "[training_signup]trainingId-status-type_index";--> statement-breakpoint
DROP INDEX "[training_signup]userProfileId-status-type_index";--> statement-breakpoint
DROP INDEX "[training_signup]passId-status-type_index";--> statement-breakpoint
DROP INDEX "[training_signup]trainingId-userProfileId_uindex";--> statement-breakpoint
DROP INDEX "[training_signup]trainingId-passId_uindex";--> statement-breakpoint
DROP INDEX "[user_profile]businessId-role-status_index";--> statement-breakpoint
DROP INDEX "[user_profile]telegramId-role-businessId_uindex";--> statement-breakpoint
DROP INDEX "[user_profile]phoneNumber-role-businessId_uindex";--> statement-breakpoint
ALTER TABLE "customer" ALTER COLUMN "first_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "studio_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer-emailAddress" ON "customer" USING btree (LOWER("email_address"));--> statement-breakpoint
CREATE UNIQUE INDEX "customer_telegram_id_index" ON "customer" USING btree ("telegram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_age_restriction_exception_user_profile_id_group_id_index" ON "group_age_restriction_exception" USING btree ("user_profile_id","group_id");--> statement-breakpoint
CREATE INDEX "group_age_restriction_group_id_index" ON "group_age_restriction" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_schedule_group_id_time_group_schedule_day_id_index" ON "group_schedule" USING btree ("group_id","time","group_schedule_day_id");--> statement-breakpoint
CREATE INDEX "group_style_variant_title_index" ON "group_style_variant" USING btree ("title");--> statement-breakpoint
CREATE INDEX "group_style_variant_studio_id_group_style_id_index" ON "group_style_variant" USING btree ("studio_id","group_style_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_style_variant_group_style_id_title_index" ON "group_style_variant" USING btree ("group_style_id","title");--> statement-breakpoint
CREATE INDEX "group_style_studio_id_index" ON "group_style" USING btree ("studio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_style_studio_id_title_index" ON "group_style" USING btree ("studio_id","title");--> statement-breakpoint
CREATE INDEX "group_studio_id_status_index" ON "group" USING btree ("studio_id","status");--> statement-breakpoint
CREATE INDEX "group_staff_member_id_status_index" ON "group" USING btree ("staff_member_id","status");--> statement-breakpoint
CREATE INDEX "group_studio_id_group_style_id_index" ON "group" USING btree ("studio_id","group_style_id");--> statement-breakpoint
CREATE INDEX "group_studio_id_staff_member_id_index" ON "group" USING btree ("studio_id","staff_member_id");--> statement-breakpoint
CREATE INDEX "pass_group_id_index" ON "pass" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "pass_client_id_index" ON "pass" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "pass_group_id_status_index" ON "pass" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "pass_client_id_status_index" ON "pass" USING btree ("client_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribtion_customer_id_index" ON "subscribtion" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "subscribtion_subscribtion_plan_id_index" ON "subscribtion" USING btree ("subscribtion_plan_id");--> statement-breakpoint
CREATE INDEX "subscribtion_customer_id_status_index" ON "subscribtion" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "subscribtion_plan_tier_index" ON "subscribtion_plan" USING btree ("tier");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribtionPlan_currencyCode3" ON "subscribtion_plan" USING btree (UPPER("currency_code_3"));--> statement-breakpoint
CREATE UNIQUE INDEX "training_date_group_id_index" ON "training" USING btree ("date","group_id");--> statement-breakpoint
CREATE INDEX "training_group_id_index" ON "training" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "training_trainer_id_index" ON "training" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "training_date_is_cancelled_index" ON "training" USING btree ("date","is_cancelled");--> statement-breakpoint
CREATE INDEX "training_is_cancelled_index" ON "training" USING btree ("is_cancelled") WHERE "training"."is_cancelled" = true;--> statement-breakpoint
CREATE INDEX "training_signup_user_profile_id_index" ON "training_signup" USING btree ("user_profile_id");--> statement-breakpoint
CREATE INDEX "training_signup_pass_id_index" ON "training_signup" USING btree ("pass_id");--> statement-breakpoint
CREATE INDEX "training_signup_training_id_index" ON "training_signup" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX "training_signup_training_id_status_type_index" ON "training_signup" USING btree ("training_id","status","type");--> statement-breakpoint
CREATE INDEX "training_signup_user_profile_id_status_type_index" ON "training_signup" USING btree ("user_profile_id","status","type");--> statement-breakpoint
CREATE INDEX "training_signup_pass_id_status_type_index" ON "training_signup" USING btree ("pass_id","status","type");--> statement-breakpoint
CREATE UNIQUE INDEX "training_signup_training_id_user_profile_id_index" ON "training_signup" USING btree ("training_id","user_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_signup_training_id_pass_id_index" ON "training_signup" USING btree ("training_id","pass_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_telegram_id_role_studio_id_index" ON "user_profile" USING btree ("telegram_id","role","studio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_phone_number_role_studio_id_index" ON "user_profile" USING btree ("phone_number","role","studio_id");--> statement-breakpoint
ALTER TABLE "studio" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "user_profile" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "group_schedule_day" ADD CONSTRAINT "dayIndex_check" CHECK ("group_schedule_day"."day_index" >= 0 AND "group_schedule_day"."day_index" <= 6);