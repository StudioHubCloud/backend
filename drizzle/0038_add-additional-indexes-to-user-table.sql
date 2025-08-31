CREATE INDEX "idx_user_profile_search_all" ON "user_profile" USING gin (to_tsvector('simple', 
        coalesce("first_name", '') || ' ' || 
        coalesce("last_name", '') || ' ' || 
        coalesce("phone_number", '')
      ));--> statement-breakpoint
CREATE INDEX "idx_user_profile_search_composite" ON "user_profile" USING btree ("studio_id","role","status","first_name");--> statement-breakpoint
CREATE INDEX "idx_active_clients" ON "user_profile" USING btree ("studio_id","full_name") WHERE "user_profile"."role" = 'client' AND "user_profile"."status" = 'active';