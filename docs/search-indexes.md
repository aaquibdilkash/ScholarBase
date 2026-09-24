# Search Index Inventory

This document records database indexes that support ScholarBase autocomplete and search. The Prisma schema remains the source of truth for tables, relations, and Prisma-managed indexes. PostgreSQL-specific search indexes are created in SQL migrations because Prisma does not fully model `pg_trgm` and `tsvector` expression indexes.

## Source-of-truth hierarchy

- `prisma/schema.prisma`: tables, relations, fields, and ordinary Prisma indexes.
- `prisma/migrations/`: exact database history, including custom PostgreSQL indexes.
- `scripts/list-search-indexes.sql`: live database inspection query.
- This document: purpose and ownership of search indexes.

## Picker-search indexes

| Index | Table | Type | Purpose |
|---|---|---|---|
| `User_handle_trgm_idx` | `User` | GIN trigram | Fuzzy handle matching |
| `User_name_trgm_idx` | `User` | GIN trigram | Fuzzy scholar-name matching |
| `User_search_text_gin_idx` | `User` | GIN expression/full text | Name, handle, and bio matching |
| `User_handle_lower_prefix_idx` | `User` | B-tree expression/prefix | Fast lower-case handle prefix lookup |
| `Journal_title_trgm_idx` | `Journal` | GIN trigram | Fuzzy journal-title matching |
| `Journal_publisher_trgm_idx` | `Journal` | GIN trigram | Fuzzy publisher matching |
| `Journal_issn_trgm_idx` | `Journal` | GIN trigram | Fuzzy ISSN matching |
| `Journal_issn_lower_prefix_idx` | `Journal` | B-tree expression/prefix | Fast lower-case ISSN prefix lookup |
| `Journal_search_text_gin_idx` | `Journal` | GIN expression/full text | Journal title, publisher, description, and subject search |

## Application search actions

- `searchScholarsForPicker()` is used by publication-author selection and user tagging.
- `searchJournalsForPicker()` is used by publication-journal selection.
- The public directory actions (`getScholars()` and `getJournals()`) remain separate because they return paginated card data and viewer-specific state.

## Inspecting the live database

Run the inspection script against the direct PostgreSQL connection:

```bash
psql "$DIRECT_URL" -f scripts/list-search-indexes.sql
```

The migration that creates these indexes is:

```text
prisma/migrations/20260924110000_optimize_picker_search/migration.sql
```

Do not remove these indexes without first removing or replacing the raw search queries that depend on them.
