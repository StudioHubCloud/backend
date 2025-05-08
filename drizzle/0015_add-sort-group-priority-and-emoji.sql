ALTER TABLE "group_style" ADD COLUMN "emoji" varchar DEFAULT '🔘' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_style" ADD COLUMN "sort_group_priority" integer DEFAULT 0 NOT NULL;