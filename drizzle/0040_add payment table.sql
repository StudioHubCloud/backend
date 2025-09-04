CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'bank_transfer', 'online', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('incoming', 'outgoing');--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'UAH' NOT NULL,
	"type" "payment_type" NOT NULL,
	"status" "payment_status" NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"studio_id" uuid NOT NULL,
	"client_id" uuid,
	"pass_id" uuid,
	"staff_member_id" uuid,
	"description" text,
	"external_transaction_id" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_pass_id_pass_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."pass"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_staff_member_id_user_profile_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."user_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_studio_id_type_status_index" ON "payment" USING btree ("studio_id","type","status");--> statement-breakpoint
CREATE INDEX "payment_client_id_status_index" ON "payment" USING btree ("client_id","status") WHERE "payment"."client_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_staff_member_id_status_index" ON "payment" USING btree ("staff_member_id","status") WHERE "payment"."staff_member_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_external_transaction_per_studio" ON "payment" USING btree ("studio_id","external_transaction_id") WHERE "payment"."external_transaction_id" IS NOT NULL;