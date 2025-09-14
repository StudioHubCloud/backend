ALTER TABLE "pass_activation_request" DROP CONSTRAINT "pass_activation_request_client_id_pass_id_fk";
--> statement-breakpoint
ALTER TABLE "pass_activation_request" ADD CONSTRAINT "pass_activation_request_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;