# Semantic embeddings (recommendations, not search)

This document covers the asynchronous `pgvector` layer added in
`prisma/migrations/20261101000000_semantic_embeddings`. It is intentionally
separate from [search indexes](./search-indexes.md): list search bars stay on
trigram + `tsvector` indexes, and no search query reads an embedding.

## What is embedded

| Entity | Table | Text fields |
| --- | --- | --- |
| Scholar | `User` | `name`, `handle`, `bio`, `interests` |
| Social post | `SocialPost` | `content` |
| Publication | `Publication` | `title`, `authors`, `keywords`, `domain`, `journalOrConference`, `abstract` |
| Article | `Article` | `title`, `excerpt`, `content` |
| Help post | `HelpPost` | `title`, `subject`, `category`, `message` |
| Contribution | `Contribution` | `title`, `message` |
| Research tool | `ResearchTool` | `name`, `use`, `description` |
| Research grant | `ResearchGrant` | `title`, `description` |
| Course | `Course` | `title`, `provider`, `instructor`, `format`, `level`, `description` |
| Journal | `Journal` | `title`, `publisher`, `about`, `subjectArea` |
| Result | `Result` | `title`, `description`, `category`, `conductingBody`, `session` |
| Survey | `ResearchSurvey` | `title`, `description` |
| Event | `ResearchEvent` | `title`, `location`, `description` |
| PhD admission | `PhdAdmission` | `university`, `department`, `description` |
| Vacancy | `JobVacancy` | `title`, `institution`, `department`, `subject`, `description` |
| Supervisor | `Supervisor` | `name`, `university`, `department`, `about` |
| Recommendation | `Recommendation` | `feedback` + parent supervisor `name`, `university`, `department`, `about` |
| Journal review | `JournalReview` | `feedback` + parent journal `title`, `publisher`, `subjectArea`, `about` |

A publication is embedded from its metadata plus abstract; the full text is not
stored or fetched. Rich-text bodies are stripped to plain text by
`stripHtmlTags`. Empty text means no vector and no job.

Recommendation and JournalReview triggers watch only `feedback`. A supervisor or
journal rename does not re-enqueue every child; editing the feedback picks up the
current parent text on the next worker run.

The registry lives in `src/lib/semantic/text.ts` (`EMBEDDING_TABLES`,
`EMBEDDING_TRIGGER_FIELDS`). `test/semantic/embedding-migration.test.ts` fails if
a table, enum value, index, trigger, or watched column drifts from it.


## Model and runtime

- `Xenova/all-MiniLM-L6-v2`, 384 dimensions, quantized `q8`, CPU execution.
- Runtime: `@huggingface/transformers` with `onnxruntime-node`. Next.js already
  externalizes both packages. `next.config.ts` still adds an
  `outputFileTracingIncludes` entry for the cron route because Next's file
  tracer cannot follow the `createRequire` call that loads the native ONNX
  backend; the entry includes only the build platform's binary (the full
  package is ~550 MB across platforms).
- Inputs are capped at 2,000 characters before tokenization. MiniLM truncates at
  256 tokens, so longer input would be discarded anyway.
- Vectors are mean-pooled and L2-normalized by the pipeline, then stored with
  cosine distance (`<=>`).
- Model loading is lazy. A missing network or a failed download leaves jobs
  queued and returns HTTP 503 from the cron route; the next run retries.

Environment:

| Variable | Purpose |
| --- | --- |
| `EMBEDDING_CACHE_DIR` | Directory for downloaded model files. Defaults to a temp-dir directory, which is lost on redeploy. In Docker, mount a writable persistent volume and point this at it (for example `/app/.cache/embeddings`). |
| `CRON_SECRET` | Required by the cron route, same as every other cron. |

No embedding-related secret is needed. The model files are public, and the
worker talks to the Hugging Face CDN on first use.

## Write path

The request path never embeds:

1. A Prisma `INSERT`/`UPDATE` writes the row. The vector column stays `NULL` on
   insert.
2. A `BEFORE INSERT OR UPDATE OF <content columns>` trigger calls
   `enqueue_embedding_job()`.
3. The trigger inserts one `EmbeddingJob` row per entity. Repeated edits coalesce
   through `ON CONFLICT ("entityType", "entityId")`, reset `attempts`, and bump
   `version`.
4. Soft delete (`isDeleted = true`) clears `NEW."embedding"` and deletes the
   queued job. Account recovery (`isDeleted` back to `false`) re-enqueues.
5. Triggers watch content columns only, not `updatedAt`. Vote/counter updates
   bump `updatedAt` and must not cause an embedding.

`User` inserts are also enqueued. Signups without a name/handle/bio/interests
produce no job because the trigger skips empty text.

## Worker and queue

Route: `GET /api/cron/embed-content` (Bearer `CRON_SECRET`).

The worker (`src/lib/semantic/worker.ts`):

- claims at most `limit` due jobs (default 20, max 100) with
  `FOR UPDATE SKIP LOCKED`
- loads all claimed rows, skipping rows that were deleted or are missing
- makes one model call for the batch
- writes each vector with a parameterized `UPDATE ... SET "embedding" = $1::vector`
- deletes only the exact `(id, version)` it embedded, so an edit during
  inference leaves the newer job queued
- retries transient failures with 5/10/20/40-minute backoff; after 5 attempts
  the job is dropped and the error is logged (the next content edit re-enqueues)
- releases the whole batch for 10 minutes when the model cannot load, without
  consuming an attempt

Stale jobs are removed when their row no longer exists or is soft-deleted.
`lockedAt` expires after 10 minutes so a crashed process does not strand a job.

Schedule it from Coolify as a scheduled task, for example every 5 minutes:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain.example/api/cron/embed-content?limit=20"
```

Start with `limit=10` on the 2 OCPU box, watch the cron duration and database
CPU, then raise it. For the initial backfill, run the task every minute with
`limit=50` until the queue drains, then return to the normal 5-minute cadence.
The route returns:

```json
{ "success": true, "claimed": 20, "processed": 20, "failed": 0, "skipped": 0 }
```

A model-load failure returns 503 with `modelUnavailable` plus the same counters.
Jobs remain queued.

## Backfill

The migration deliberately does not backfill; enqueue existing rows after the
deploy so the migration itself stays fast:

```bash
psql "$DIRECT_URL" -f scripts/backfill-semantic-embeddings.sql
```

Run it during a low-traffic window. It inserts job rows only (one per non-deleted
row whose vector is still `NULL`), so it is cheap compared with embedding. The
worker then drains the queue at its configured batch size. Re-running is safe;
clear the `embedding` column first if you intentionally want a full rebuild.

## Matching queries

Helpers live in `src/lib/semantic/matching.ts`:

- `findScholarsForPost(postId, limit)`
- `findSimilarScholars(userId, limit)`
- `findScholarsForPublication(publicationId, limit)`

Same-type "related" lookups live in `src/lib/semantic/related.ts`:

- `getRelatedContent(entityType, entityId, limit)` → `{ id, href, title,
  subtitle, similarity }[]` for every one of the 18 entity types.

Each helper returns ordered matches. `matching.ts` returns ids and scores;
`related.ts` hydrates the same-type top-N for the detail-page
`<RelatedContent>` section (one HNSW query plus one primary-key query). It
filters `isDeleted = false` and, for contributions, `status = 'APPROVED'`.
Similarity is `1 - distance`, so 1 is identical and 0 is orthogonal.

The core shape (`related.ts` substitutes the table from `EMBEDDING_TABLES`):


```sql
SELECT scholar."id",
       1 - (scholar."embedding" <=> (
         SELECT "embedding"
         FROM "SocialPost"
         WHERE "id" = $1 AND "isDeleted" = false AND "embedding" IS NOT NULL
       )) AS similarity
FROM "User" AS scholar
WHERE scholar."isDeleted" = false
  AND scholar."embedding" IS NOT NULL
  AND scholar."id" <> (
    SELECT "authorId"
    FROM "SocialPost"
    WHERE "id" = $1 AND "isDeleted" = false AND "embedding" IS NOT NULL
  )
ORDER BY scholar."embedding" <=> (
  SELECT "embedding"
  FROM "SocialPost"
  WHERE "id" = $1 AND "isDeleted" = false AND "embedding" IS NOT NULL
)
LIMIT $2;
```

The repeated scalar subquery is deliberate. pgvector's HNSW scan needs the
distance operand to be an InitPlan/constant; rewriting this as
`WITH source AS (...) CROSS JOIN source` makes the planner choose a sequential
scan plus sort, even with the index available.

These helpers do not send notifications or filter follow/block relationships;
the caller owns that policy before exposing a match to a user.

## Detail pages

Every content detail page renders a same-type "Related ..." section below the
card via `<RelatedContent>`:

| Page | Entity type | Heading |
| --- | --- | --- |
| `/scholars/[id]` | `SCHOLAR` | Similar scholars |
| `/feed/[id]` | `SOCIAL_POST` | Related posts |
| `/publications/[id]` | `PUBLICATION` | Related publications |
| `/blog/[slug]` | `ARTICLE` | Related articles |
| `/help/[id]` | `HELP_POST` | Related help posts |
| `/contributions/[id]` | `CONTRIBUTION` | Related contributions |
| `/research-tools/[id]` | `RESEARCH_TOOL` | Related research tools |
| `/grants/[id]` | `RESEARCH_GRANT` | Related grants |
| `/learn/[id]` | `COURSE` | Related courses |
| `/journals/[id]` | `JOURNAL` | Related journals |
| `/results/[id]` | `RESULT` | Related results |
| `/surveys/[id]` | `RESEARCH_SURVEY` | Related surveys |
| `/events/[id]` | `RESEARCH_EVENT` | Related events |
| `/admissions/[id]` | `PHD_ADMISSION` | Related PhD admissions |
| `/vacancies/[id]` | `JOB_VACANCY` | Related vacancies |
| `/supervisor/[id]` | `SUPERVISOR` | Related supervisors |
| `/supervisor/[id]/recommendation/[recommendationId]` | `RECOMMENDATION` | Related recommendations |
| `/journals/[id]/review/[reviewId]` | `JOURNAL_REVIEW` | Related journal reviews |

The section renders nothing when the source has no vector yet (fresh row, worker
not run) or when fewer than one neighbour was hydrated, so a detail page is
never blocked on the embedding backfill. Soft-deleted detail pages skip the
query entirely, and any lookup failure is logged and rendered as an empty
section rather than a page error.

## Indexes and cost

Every one of the 18 tables has a partial HNSW index using `vector_cosine_ops`
with `m = 16`, `ef_construction = 64`, named
`<Table>_embedding_hnsw_idx` (for example `User_embedding_hnsw_idx`,
`JobVacancy_embedding_hnsw_idx`).

The predicate is `WHERE "embedding" IS NOT NULL`, which matches the matching
queries and keeps soft-deleted rows out. HNSW is approximate: top-N recall can be
raised per session with `SET LOCAL hnsw.ef_search = 100` (default 40) if a caller
needs it. Growing the index on writes costs CPU, which is why the worker batch is
bounded and cron-driven.

For a very large initial backfill, the migration creates the empty index first;
each worker update then inserts incrementally instead of one long blocking index
build. If the index becomes large, check it with:

```sql
SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE indexrelname LIKE '%_embedding_hnsw_idx';
```

Do not create these indexes concurrently inside a Prisma migration: Prisma runs
each migration in a transaction and `CREATE INDEX CONCURRENTLY` cannot run there.

## Preflight and failure modes

Run before deploying:

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'vector';

SELECT e.extname, n.nspname
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'vector';

SHOW search_path;
```

If `vector` is not in `pg_available_extensions`, the Postgres image was built
without pgvector and the migration cannot run. If the extension is installed in
a schema such as `extensions`, make sure that schema is on the connection
`search_path`; the migration and runtime SQL use the unqualified `vector` type.

The worker is safe to run with a cold cache: a failed download is recorded in
`EmbeddingJob.lastError`, jobs are released, and the route returns 503. It never
runs during `next build`.

## Inspecting the queue

```sql
SELECT "entityType", count(*) AS queued
FROM "EmbeddingJob"
GROUP BY 1;

SELECT "entityType", "entityId", "attempts", "runAt", "lastError"
FROM "EmbeddingJob"
WHERE "lastError" IS NOT NULL
ORDER BY "updatedAt" DESC
LIMIT 20;
```

## Tests

- `test/semantic/embedding-text.test.ts` — text projections and field lists.
- `test/semantic/embedding-migration.test.ts` — vector columns, HNSW indexes,
  enum values, trigger mapping, and trigger columns matching the text builders.
- `test/semantic/related.test.ts` — related-query shape, hydration mapping, and
  the contribution approval filter.
- `test/semantic/embedding-vector.test.ts` — pgvector literal formatting and
  dimension checks.
- `test/semantic/embedding-worker.test.ts` — batch limits and retry backoff.
- `test/search/trgm-index-coverage.test.ts` — search indexes stay independent of
  embeddings.
