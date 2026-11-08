CREATE TABLE "user_profile_guardian" (
	"guardian_profile_id" uuid NOT NULL,
	"child_profile_id" uuid NOT NULL,
	"studio_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_guardian_guardian_profile_id_child_profile_id_pk" PRIMARY KEY("guardian_profile_id","child_profile_id")
);
--> statement-breakpoint
ALTER TABLE "user_profile" ALTER COLUMN "telegram_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "acting_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "user_profile_guardian" ADD CONSTRAINT "user_profile_guardian_guardian_profile_id_user_profile_id_fk" FOREIGN KEY ("guardian_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile_guardian" ADD CONSTRAINT "user_profile_guardian_child_profile_id_user_profile_id_fk" FOREIGN KEY ("child_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile_guardian" ADD CONSTRAINT "user_profile_guardian_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_profile_guardian_child_profile_id_index" ON "user_profile_guardian" USING btree ("child_profile_id");--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_acting_profile_id_user_profile_id_fk" FOREIGN KEY ("acting_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE set null ON UPDATE no action;