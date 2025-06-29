ALTER TABLE "pass" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pass" ALTER COLUMN "end_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "sale_date" date NOT NULL;