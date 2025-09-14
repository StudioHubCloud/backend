CREATE TABLE "pass_activation_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" varchar NOT NULL,
	"pass_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"studio_id" uuid NOT NULL,
	CONSTRAINT "pass_activation_request_pass_id_unique" UNIQUE("pass_id"),
	CONSTRAINT "pass_activation_request_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "pass_activation_request" ADD CONSTRAINT "pass_activation_request_pass_id_pass_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."pass"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_activation_request" ADD CONSTRAINT "pass_activation_request_client_id_pass_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."pass"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_activation_request" ADD CONSTRAINT "pass_activation_request_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;