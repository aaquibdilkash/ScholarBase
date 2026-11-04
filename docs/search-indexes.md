# Search Index Inventory

This document records the database indexes that support ScholarBase autocomplete and search. `prisma/schema.prisma` remains the source of truth for tables, relations, and Prisma-managed indexes. PostgreSQL-specific search indexes live in SQL migrations because Prisma does not fully model `pg_trgm`, `tsvector`, or `pgvector` objects.

## Source-of-truth hierarchy

- `prisma/schema.prisma`: tables, relations, fields, and ordinary Prisma indexes.
- `prisma/migrations/`: exact database history, including custom PostgreSQL indexes.
- `scripts/list-search-indexes.sql`: live database inspection query (definitions + sizes).
- This document: purpose and ownership of search indexes.

## Extensions

The search migrations expect these PostgreSQL extensions:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- fuzzy/substring matching
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector, only for the embedding tables
```

Supabase's Postgres image normally ships both extensions, but confirm them on the Coolify database before deploying the vector migration:

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name IN ('pg_trgm', 'vector');
```

`pg_trgm` is installed by the trigram migration itself. The `vector` extension is created by the embedding migration; if it is missing from `pg_available_extensions`, the Postgres image was built without pgvector and the vector migration must wait for that image change. Embeddings are recommendation inputs only and are not used by any search query; see [semantic-embeddings.md](./semantic-embeddings.md) for the async pipeline and HNSW indexes.

## Picker-search indexes

| Index | Table | Type | Purpose |
|---|---|---|---|
| `User_handle_trgm_idx` | `User` | GIN trigram | Fuzzy handle matching |
| `User_name_trgm_idx` | `User` | GIN trigram | Fuzzy scholar-name matching |
| `User_bio_trgm_idx` | `User` | GIN trigram | Scholar bio substring matching |
| `User_search_text_gin_idx` | `User` | GIN expression/full text | Name, bio, and interests matching |
| `User_handle_lower_prefix_idx` | `User` | B-tree expression/prefix | Fast lower-case handle equality/prefix lookup |
| `Journal_title_trgm_idx` | `Journal` | GIN trigram | Fuzzy journal-title matching |
| `Journal_publisher_trgm_idx` | `Journal` | GIN trigram | Fuzzy publisher matching |
| `Journal_about_trgm_idx` | `Journal` | GIN trigram | Journal description substring matching |
| `Journal_issn_trgm_idx` | `Journal` | GIN trigram | Fuzzy ISSN matching |
| `Journal_search_text_gin_idx` | `Journal` | GIN expression/full text | Title, publisher, description, and subject search |
| `Journal_issn_lower_prefix_idx` | `Journal` | B-tree expression/prefix | Fast lower-case ISSN equality/prefix lookup |

The raw picker SQL also ranks with `similarity()` / `word_similarity()`. Those function calls are not index-backed by `pg_trgm`; the indexable branches in the same `OR` are `ILIKE`, `LOWER(...) LIKE prefix`, and the `to_tsvector(...) @@ plainto_tsquery(...)` expression. The planner can use those branches and recheck the similarity branches.

## List-search indexes

Every list search is one Prisma `OR` over the fields declared in
`CONTENT_LIST_CONFIGS` (`src/lib/tri-split/modules/registry.ts`). PostgreSQL can
only build a `BitmapOr` when every branch is indexable, so this inventory
indexes every declared field, not only the high-traffic ones.

| Module | Table | Indexed columns |
|---|---|---|
| Feed | `SocialPost` | `content` |
| Articles | `Article` | `title`; author `name`/`handle` via `User` |
| Scholars | `User` | `name`, `handle`, `bio` |
| Help | `HelpPost` | `title`, `subject`, `message` |
| Contributions | `Contribution` | `title`, `message` |
| Publications | `Publication` | `title`, `authors`, `keywords`, `domain`, `journalOrConference`, `abstract` |
| Research tools | `ResearchTool` | `name`, `website`, `use`, `description` |
| Grants | `ResearchGrant` | `title`, `amount`, `description`, `applyLink`, `infoLink` |
| Courses | `Course` | `title`, `provider`, `instructor`, `format`, `level`, `description` |
| Journals | `Journal` | `title`, `publisher`, `about`, `issn`; picker text expression |
| Results | `Result` | `title`, `description`, `category`, `conductingBody`, `session` |
| Surveys | `ResearchSurvey` | `title`, `description` |
| Events | `ResearchEvent` | `title`, `location`, `description` |
| PhD admissions | `PhdAdmission` | `university`, `department`, `description` |
| Vacancies | `JobVacancy` | `title`, `institution`, `department`, `subject`, `description` |
| Supervisors | `Supervisor` | `name` |

Index names follow `<Table>_<column>_trgm_idx`. The migration is
`prisma/migrations/20261031120000_search_trgm_indexes/migration.sql`.

### Why per-column instead of one concatenated index

A single `search_text` generated column per table with one GIN index would be
cheaper to write, but it changes the query shape for every module and cannot
express the picker's per-field similarity ranking. The per-column inventory is
the smallest change that keeps the existing Prisma queries and result semantics.
If write amplification becomes a problem, consolidate a module's long free-text
columns first and measure `pg_indexes_size()` before and after.

### Operational notes

- GIN trigram indexes are write-amplifying. The Coolify box has 2 OCPU; check
  index size and write latency after deploy.
- `CREATE INDEX` is intentionally non-concurrent because Prisma wraps each
  migration in a transaction. On a large table, schedule the migration in a
  maintenance window; do not rewrite it as `CREATE INDEX CONCURRENTLY` without
  moving it out of the Prisma transaction.
- The migration uses `IF NOT EXISTS` so it is safe if the old Supabase indexes
  were carried over manually. It does not verify that an existing index with the
  same name has the same definition; use the inspection script.
- A new search field must add its index in the same change.
  `test/search/trgm-index-coverage.test.ts` fails otherwise.

## Inspecting the live database

Run the inspection script against the direct PostgreSQL connection:

```bash
psql "$DIRECT_URL" -f scripts/list-search-indexes.sql
```

Do not remove these indexes without first removing or replacing the queries that
depend on them.
