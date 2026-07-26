ALTER TYPE "public"."audit_log_actions_enum" ADD VALUE 'ai_assistant_action';--> statement-breakpoint
CREATE TABLE "knowledge_base_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"studio_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"category" varchar,
	"source_text" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_base_chunk" ADD CONSTRAINT "knowledge_base_chunk_document_id_knowledge_base_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_base_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_base_chunk_document_idx" ON "knowledge_base_chunk" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_base_chunk_studio_idx" ON "knowledge_base_chunk" USING btree ("studio_id");--> statement-breakpoint
CREATE INDEX "knowledge_base_chunk_embedding_hnsw_idx" ON "knowledge_base_chunk" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_base_document_studio_slug_idx" ON "knowledge_base_document" USING btree ("studio_id","slug");--> statement-breakpoint
CREATE INDEX "knowledge_base_document_studio_idx" ON "knowledge_base_document" USING btree ("studio_id");