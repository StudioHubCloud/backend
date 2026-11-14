CREATE TABLE "pass_group" (
	"pass_id" uuid NOT NULL,
	"group_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pass_group_pass_id_group_id_pk" PRIMARY KEY("pass_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "pass_template" ADD COLUMN "multi_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pass_group" ADD CONSTRAINT "pass_group_pass_id_pass_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."pass"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_group" ADD CONSTRAINT "pass_group_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pass_group_group_id_index" ON "pass_group" USING btree ("group_id");