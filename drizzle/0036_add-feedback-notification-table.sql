CREATE TABLE "user_profile_feedback_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_sent_date" date,
	"next_due_date" date NOT NULL,
	"current_interval_days" smallint DEFAULT 60 NOT NULL,
	"feedback_given" boolean DEFAULT false NOT NULL,
	"snooze_count" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_profile_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile_feedback_notification" ADD CONSTRAINT "user_profile_feedback_notification_user_profile_id_user_profile_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_feedback_notification_user_profile_id_index" ON "user_profile_feedback_notification" USING btree ("user_profile_id");--> statement-breakpoint
CREATE INDEX "user_profile_feedback_notification_next_due_date_is_active_feedback_given_index" ON "user_profile_feedback_notification" USING btree ("next_due_date","is_active","feedback_given");--> statement-breakpoint
CREATE INDEX "user_profile_feedback_notification_feedback_given_is_active_index" ON "user_profile_feedback_notification" USING btree ("feedback_given","is_active");