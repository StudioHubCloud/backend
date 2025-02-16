CREATE TYPE "public"."status" AS ENUM('active', 'inactive', 'not_verified', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('basic', 'professional', 'elite');--> statement-breakpoint
CREATE TYPE "public"."type" AS ENUM('main', 'reserve', 'personal');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'staff_member', 'guest', 'client');--> statement-breakpoint
CREATE TABLE "business" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar NOT NULL,
	"public_email" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"website_url" varchar,
	"customer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_profile_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar NOT NULL,
	"email_address" varchar NOT NULL,
	"phone_number" varchar,
	"telegram_id" varchar,
	"country_code" varchar DEFAULT 'UA',
	CONSTRAINT "customer_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "customer_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "group_schedule_day" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_index" smallint NOT NULL,
	"day_title_long" varchar NOT NULL,
	"day_title_short" varchar(3) NOT NULL,
	CONSTRAINT "group_schedule_day_day_index_unique" UNIQUE("day_index"),
	CONSTRAINT "group_schedule_day_day_title_long_unique" UNIQUE("day_title_long"),
	CONSTRAINT "group_schedule_day_day_title_short_unique" UNIQUE("day_title_short"),
	CONSTRAINT "[group_schedule_day]dayIndex_check" CHECK ("group_schedule_day"."day_index" >= 0 AND "group_schedule_day"."day_index" <= 6)
);
--> statement-breakpoint
CREATE TABLE "group_schedule" (
	"id" uuid PRIMARY KEY NOT NULL,
	"time" timestamp NOT NULL,
	"group_id" uuid NOT NULL,
	"group_schedule_day_id" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_style_variant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"description" varchar,
	"studio_id" uuid NOT NULL,
	"group_style_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_style" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"studio_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"capacity" smallint NOT NULL,
	"min_age_requirement" smallint,
	"studio_id" uuid NOT NULL,
	"group_style_id" integer NOT NULL,
	"staff_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "pass" (
	"id" uuid PRIMARY KEY NOT NULL,
	"price" smallint NOT NULL,
	"length" smallint NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"paused_from_date" timestamp,
	"paused_to_date" timestamp,
	"expired_from_date" timestamp,
	"status" "status" NOT NULL,
	"group_id" uuid,
	"client_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_profile_id" uuid
);
--> statement-breakpoint
CREATE TABLE "studio" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar,
	"street_address_1" varchar NOT NULL,
	"street_address_2" varchar,
	"city" varchar,
	"state" varchar,
	"country" varchar,
	"business_id" uuid
);
--> statement-breakpoint
CREATE TABLE "subscribtion" (
	"id" serial PRIMARY KEY NOT NULL,
	"paused_from_date" timestamp,
	"paused_to_date" timestamp,
	"expired_from_date" timestamp,
	"status" "status" NOT NULL,
	"subscribtion_plan_id" "smallserial" NOT NULL,
	"customer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribtion_plan" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"tier" "tier" NOT NULL,
	"description" varchar NOT NULL,
	"price" smallint NOT NULL,
	"currency_code_3" varchar(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"group_id" uuid NOT NULL,
	"trainer_id" uuid
);
--> statement-breakpoint
CREATE TABLE "training_schedule" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "status" NOT NULL,
	"type" "type" NOT NULL,
	"user_profile_id" uuid,
	"pass_id" uuid,
	"training_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"telegram_id" varchar NOT NULL,
	"role" "role" NOT NULL,
	"status" "status" NOT NULL,
	"business_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business" ADD CONSTRAINT "business_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_user_profile_id_user_profile_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_schedule" ADD CONSTRAINT "group_schedule_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_schedule" ADD CONSTRAINT "group_schedule_group_schedule_day_id_group_schedule_day_id_fk" FOREIGN KEY ("group_schedule_day_id") REFERENCES "public"."group_schedule_day"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_style_variant" ADD CONSTRAINT "group_style_variant_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_style_variant" ADD CONSTRAINT "group_style_variant_group_style_id_group_style_id_fk" FOREIGN KEY ("group_style_id") REFERENCES "public"."group_style"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_style" ADD CONSTRAINT "group_style_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_group_style_id_group_style_id_fk" FOREIGN KEY ("group_style_id") REFERENCES "public"."group_style"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_staff_member_id_staff_member_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass" ADD CONSTRAINT "pass_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass" ADD CONSTRAINT "pass_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_member" ADD CONSTRAINT "staff_member_user_profile_id_user_profile_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio" ADD CONSTRAINT "studio_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscribtion" ADD CONSTRAINT "subscribtion_subscribtion_plan_id_subscribtion_plan_id_fk" FOREIGN KEY ("subscribtion_plan_id") REFERENCES "public"."subscribtion_plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscribtion" ADD CONSTRAINT "subscribtion_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training" ADD CONSTRAINT "training_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training" ADD CONSTRAINT "training_trainer_id_staff_member_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."staff_member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_schedule" ADD CONSTRAINT "training_schedule_user_profile_id_user_profile_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_schedule" ADD CONSTRAINT "training_schedule_pass_id_pass_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."pass"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_schedule" ADD CONSTRAINT "training_schedule_training_id_training_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."training"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "[business]displayName-customerId_uindex" ON "business" USING btree ("customer_id","display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "[business]publicEmail-customerId_uindex" ON "business" USING btree ("customer_id","public_email");--> statement-breakpoint
CREATE UNIQUE INDEX "[business]phoneNumber-customerId_uindex" ON "business" USING btree ("customer_id","phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "[customer]emailAddress_uindex" ON "customer" USING btree (LOWER("email_address"));--> statement-breakpoint
CREATE UNIQUE INDEX "[customer]telegramId_uindex" ON "customer" USING btree ("telegram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "[group_schedule_time]groupId_uindex" ON "group_schedule" USING btree ("time","group_id");--> statement-breakpoint
CREATE INDEX "title_index" ON "group_style_variant" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "[group_style_variant]groupStyleId-title_uindex" ON "group_style_variant" USING btree ("group_style_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "[group_style_variant]studioId-groupStyleId_uindex" ON "group_style_variant" USING btree ("studio_id","group_style_id");--> statement-breakpoint
CREATE INDEX "studioId_index" ON "group_style" USING btree ("studio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "[group_style]studioId-title_uindex" ON "group_style" USING btree ("studio_id","title");--> statement-breakpoint
CREATE INDEX "[group]studioId_index" ON "group" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "[group]staffMemberId_index" ON "group" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "[group]studioId-groupStyleId_uindex" ON "group" USING btree ("studio_id","group_style_id");--> statement-breakpoint
CREATE INDEX "[group]studioId-staffMemberId_uindex" ON "group" USING btree ("studio_id","staff_member_id");--> statement-breakpoint
CREATE INDEX "[pass]groupId_index" ON "pass" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "[pass]clientId_index" ON "pass" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "[pass]groupId-status_index" ON "pass" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "[pass]clientId-status_index" ON "pass" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "[studio]businessId_index" ON "studio" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "[subscribtion]customerId_uindex" ON "subscribtion" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "[subscribtion]subscribtionPlanId_index" ON "subscribtion" USING btree ("subscribtion_plan_id");--> statement-breakpoint
CREATE INDEX "[subscribtion]customerId-status_index" ON "subscribtion" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "[subscribtion_plan]tier_uindex" ON "subscribtion_plan" USING btree ("tier");--> statement-breakpoint
CREATE UNIQUE INDEX "[subscribtion_plan]currencyCode3_uindex" ON "subscribtion_plan" USING btree (UPPER("currency_code_3"));--> statement-breakpoint
CREATE INDEX "[training]groupId_index" ON "training" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "[training]trainerId_index" ON "training" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "[training]date-isCancelled_index" ON "training" USING btree ("date","is_cancelled");--> statement-breakpoint
CREATE INDEX "[training]isCancelled(true)_index" ON "training" USING btree ("is_cancelled") WHERE "training"."is_cancelled" = true;--> statement-breakpoint
CREATE INDEX "[training_schedule]userProfileId_index" ON "training_schedule" USING btree ("user_profile_id");--> statement-breakpoint
CREATE INDEX "[training_schedule]passId_index" ON "training_schedule" USING btree ("pass_id");--> statement-breakpoint
CREATE INDEX "[training_schedule]trainingId_index" ON "training_schedule" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX "[training_schedule]trainingId-status-type_index" ON "training_schedule" USING btree ("training_id","status","type");--> statement-breakpoint
CREATE INDEX "[training_schedule]userProfileId-status-type_index" ON "training_schedule" USING btree ("user_profile_id","status","type");--> statement-breakpoint
CREATE INDEX "[training_schedule]passId-status-type_index" ON "training_schedule" USING btree ("pass_id","status","type");--> statement-breakpoint
CREATE UNIQUE INDEX "[training_schedule]trainingId-userProfileId_uindex" ON "training_schedule" USING btree ("training_id","user_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "[training_schedule]trainingId-passId_uindex" ON "training_schedule" USING btree ("training_id","pass_id");--> statement-breakpoint
CREATE INDEX "[user_profile]businessId-role-status_index" ON "user_profile" USING btree ("business_id","role","status");--> statement-breakpoint
CREATE UNIQUE INDEX "[user_profile]telegramId-role-businessId_uindex" ON "user_profile" USING btree ("telegram_id","role","business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "[user_profile]phoneNumber-role-businessId_uindex" ON "user_profile" USING btree ("phone_number","role","business_id");