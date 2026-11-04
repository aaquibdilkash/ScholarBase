-- Inspect the live ScholarBase search indexes and their sizes.
-- Usage: psql "$DIRECT_URL" -f scripts/list-search-indexes.sql

SELECT
  tablename,
  indexname,
  pg_size_pretty(
    pg_relation_size(format('%I.%I', schemaname, indexname)::regclass)
  ) AS index_size,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%trgm%'
    OR indexname LIKE '%search_text_gin%'
    OR indexname LIKE '%lower_prefix%'
    OR indexname LIKE '%embedding%'
  )
ORDER BY tablename, indexname;
