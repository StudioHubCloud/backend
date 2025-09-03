DROP INDEX "idx_user_profile_search_all";--> statement-breakpoint
DROP INDEX "idx_user_profile_search_composite";--> statement-breakpoint
DROP INDEX "idx_active_clients";--> statement-breakpoint
ALTER TABLE "staff_member" ALTER COLUMN "user_profile_id" SET NOT NULL;