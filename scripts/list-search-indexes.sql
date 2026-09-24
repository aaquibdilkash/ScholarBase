-- Inspect the live ScholarBase search indexes.
-- Usage: psql "$DIRECT_URL" -f scripts/list-search-indexes.sql

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('User', 'Journal')
  AND (
    indexname LIKE '%trgm%'
    OR indexname LIKE '%search%'
    OR indexname LIKE '%lower_prefix%'
  )
ORDER BY tablename, indexname;
