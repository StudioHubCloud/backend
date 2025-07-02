ALTER TABLE "user_profile_feedback_notification" RENAME TO "feedback_notification";--> statement-breakpoint
ALTER TABLE "feedback_notification" DROP CONSTRAINT "user_profile_feedback_notification_user_profile_id_user_profile_id_fk";
--> statement-breakpoint
DROP INDEX "user_profile_feedback_notification_user_profile_id_index";--> statement-breakpoint
DROP INDEX "user_profile_feedback_notification_next_due_date_is_active_feedback_given_index";--> statement-breakpoint
DROP INDEX "user_profile_feedback_notification_feedback_given_is_active_index";--> statement-breakpoint
ALTER TABLE "feedback_notification" ADD CONSTRAINT "feedback_notification_user_profile_id_user_profile_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_notification_user_profile_id_index" ON "feedback_notification" USING btree ("user_profile_id");--> statement-breakpoint
CREATE INDEX "feedback_notification_next_due_date_is_active_feedback_given_index" ON "feedback_notification" USING btree ("next_due_date","is_active","feedback_given");--> statement-breakpoint
CREATE INDEX "feedback_notification_feedback_given_is_active_index" ON "feedback_notification" USING btree ("feedback_given","is_active");