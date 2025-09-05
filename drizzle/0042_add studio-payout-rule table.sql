CREATE TYPE "public"."studio_payout_rule_type_enum" AS ENUM('fixed', 'percentage', 'per_signup');--> statement-breakpoint
ALTER TYPE "public"."payment_method" RENAME TO "payment_method_enum";--> statement-breakpoint
ALTER TYPE "public"."payment_status" RENAME TO "payment_status_enum";--> statement-breakpoint
ALTER TYPE "public"."payment_type" RENAME TO "payment_type_enum";--> statement-breakpoint
CREATE TABLE "studio_payout_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"min_signups" integer DEFAULT 0 NOT NULL,
	"max_signups" integer,
	"type" "studio_payout_rule_type_enum" NOT NULL,
	"amount" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"studio_id" uuid NOT NULL,
	"staff_member_id" uuid
);
--> statement-breakpoint
ALTER TABLE "studio_payout_rule" ADD CONSTRAINT "studio_payout_rule_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_payout_rule" ADD CONSTRAINT "studio_payout_rule_staff_member_id_staff_member_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_payout_rule_studio_id_is_active_index" ON "studio_payout_rule" USING btree ("studio_id","is_active");--> statement-breakpoint
CREATE INDEX "studio_payout_rule_studio_id_staff_member_id_is_active_index" ON "studio_payout_rule" USING btree ("studio_id","staff_member_id","is_active");