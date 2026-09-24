CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "User_handle_trgm_idx"
  ON "User" USING GIN ("handle" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
  ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_search_text_gin_idx"
  ON "User" USING GIN (to_tsvector('simple', COALESCE("name", '') || ' ' || COALESCE("handle", '') || ' ' || COALESCE("bio", '')));

CREATE INDEX IF NOT EXISTS "Journal_title_trgm_idx"
  ON "Journal" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Journal_publisher_trgm_idx"
  ON "Journal" USING GIN ("publisher" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Journal_issn_trgm_idx"
  ON "Journal" USING GIN ("issn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Journal_search_text_gin_idx"
  ON "Journal" USING GIN (to_tsvector('simple', COALESCE("title", '') || ' ' || COALESCE("publisher", '') || ' ' || COALESCE("about", '') || ' ' || COALESCE("subjectArea", '')));

CREATE INDEX IF NOT EXISTS "User_handle_lower_prefix_idx"
  ON "User" (LOWER("handle") text_pattern_ops);
CREATE INDEX IF NOT EXISTS "Journal_issn_lower_prefix_idx"
  ON "Journal" (LOWER("issn") text_pattern_ops);
