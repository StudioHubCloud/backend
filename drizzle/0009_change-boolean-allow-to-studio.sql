ALTER TABLE "studio" DROP COLUMN "allow_training_insert_cron";
ALTER TABLE "studio" ADD COLUMN "allow_training_insert_cron" boolean DEFAULT false;