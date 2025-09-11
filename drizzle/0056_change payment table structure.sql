CREATE TABLE "staff_member_payout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'UAH' NOT NULL,
	"paid_at" timestamp,
	"studio_id" uuid NOT NULL,
	"staff_member_id" uuid,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_staff_member_id_staff_member_id_fk";
--> statement-breakpoint
DROP INDEX "payment_studio_id_type_status_index";--> statement-breakpoint
DROP INDEX "payment_staff_member_id_status_index";--> statement-breakpoint
DROP INDEX "payment_staff_member_id_paid_at_index";--> statement-breakpoint
DROP INDEX "unique_outgoing_payout_per_trainer_per_day";--> statement-breakpoint
ALTER TABLE "training" ADD COLUMN "staff_member_payout_id" uuid;--> statement-breakpoint
ALTER TABLE "staff_member_payout" ADD CONSTRAINT "staff_member_payout_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_member_payout" ADD CONSTRAINT "staff_member_payout_staff_member_id_staff_member_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_member_payout_studio_id_staff_member_id_index" ON "staff_member_payout" USING btree ("studio_id","staff_member_id");--> statement-breakpoint
CREATE INDEX "staff_member_payout_studio_id_staff_member_id_paid_at_index" ON "staff_member_payout" USING btree ("studio_id","staff_member_id","paid_at");--> statement-breakpoint
ALTER TABLE "training" ADD CONSTRAINT "training_staff_member_payout_id_staff_member_payout_id_fk" FOREIGN KEY ("staff_member_payout_id") REFERENCES "public"."staff_member_payout"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_studio_id_status_index" ON "payment" USING btree ("studio_id","status");--> statement-breakpoint
ALTER TABLE "payment" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "payment" DROP COLUMN "staff_member_id";--> statement-breakpoint
DROP TYPE "public"."payment_type_enum";