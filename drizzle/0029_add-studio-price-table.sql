CREATE TYPE "public"."studio_price_type_enum" AS ENUM('trial', 'one_time_group', 'one_time_individual', 'duo', 'trio');--> statement-breakpoint
CREATE TABLE "studio_price" (
	"id" uuid PRIMARY KEY NOT NULL,
	"studio_id" uuid,
	"name" varchar NOT NULL,
	"price" smallint NOT NULL,
	"type" "studio_price_type_enum" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "trial_discount" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_price" ADD CONSTRAINT "studio_price_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "studio_price_studio_id_name_index" ON "studio_price" USING btree ("studio_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "studio_price_studio_id_type_index" ON "studio_price" USING btree ("studio_id","type");