ALTER TABLE "pass" ADD COLUMN "studio_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pass" ADD CONSTRAINT "pass_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pass_studio_id_index" ON "pass" USING btree ("studio_id");