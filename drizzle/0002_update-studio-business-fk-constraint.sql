ALTER TABLE "studio" DROP CONSTRAINT "studio_business_id_business_id_fk";
--> statement-breakpoint
ALTER TABLE "studio" ADD CONSTRAINT "studio_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;