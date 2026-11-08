CREATE TABLE "pass_template_freeze_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"max_days" smallint NOT NULL,
	"pass_template_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "frozen_from" date;--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "frozen_days" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pass_template_freeze_rule" ADD CONSTRAINT "pass_template_freeze_rule_pass_template_id_pass_template_id_fk" FOREIGN KEY ("pass_template_id") REFERENCES "public"."pass_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pass_template_freeze_rule_pass_template_id_index" ON "pass_template_freeze_rule" USING btree ("pass_template_id");