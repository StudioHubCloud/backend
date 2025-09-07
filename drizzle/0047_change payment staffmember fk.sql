ALTER TABLE "payment" DROP CONSTRAINT "payment_staff_member_id_user_profile_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_staff_member_id_staff_member_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_member"("id") ON DELETE set null ON UPDATE no action;