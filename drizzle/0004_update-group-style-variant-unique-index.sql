DROP INDEX "[group_style_variant]studioId-groupStyleId_uindex";
CREATE INDEX "[group_style_variant]studioId-groupStyleId_index" ON "group_style_variant" USING btree ("studio_id","group_style_id");