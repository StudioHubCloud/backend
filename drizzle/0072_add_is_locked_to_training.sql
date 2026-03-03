ALTER TABLE "training" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "training_is_locked_index" ON "training" USING btree ("is_locked");