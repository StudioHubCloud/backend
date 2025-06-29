ALTER TABLE "pass" ALTER COLUMN "start_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "pass" ALTER COLUMN "end_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "pass" ALTER COLUMN "paused_from_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "pass" ALTER COLUMN "paused_to_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "pass" ALTER COLUMN "expired_from_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "reminder_sent" boolean DEFAULT false NOT NULL;