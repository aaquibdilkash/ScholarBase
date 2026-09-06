# Prisma Migration Playbook: Baselining & Drift Recovery

Standard operating procedure for synchronizing live Supabase (PostgreSQL) databases with Prisma schemas without data loss, resetting schemas, or encountering `P3018` collision errors.

---

## 1. When to Use This Playbook

Use this procedure whenever:

* A local `prisma/migrations` folder has been deleted or lost, but the database contains live data.
* `npx prisma migrate dev` warns: `Drift detected: Your database schema is not in sync with your migration history`.
* Prisma prompts to reset the database (`We need to reset the "public" schema... All data will be lost`).
* `npx prisma migrate deploy` fails on production with error `P3018` (e.g., `ERROR: type "..." already exists` or `relation "..." already exists`).

> **CRITICAL WARNING:** Never execute `prisma migrate reset` or type `y` to destructive prompts against databases containing live or test-critical data.

---

## 2. Phase 1: Establish the Baseline on Development/Staging

This phase creates a baseline migration (`0_init`) representing the current live database state so Prisma recognizes existing tables.

### Step 1: Clean Orphaned Migration Logs

If migration files were previously deleted or modified locally, reset Prisma's internal tracking ledger without touching application tables.

In the **Supabase SQL Editor** (Development project):

```sql
TRUNCATE TABLE "_prisma_migrations";

```

*Verification:*

```sql
SELECT count(*) FROM "_prisma_migrations"; -- Must return 0

```

### Step 2: Create the Baseline Migration Directory

In your project root terminal:

```bash
mkdir -p prisma/migrations/0_init

```

### Step 3: Extract the Live Schema via Prisma Config

Generate the baseline SQL script by comparing an empty state to the live database (using Prisma 7's config datasource):

```bash
npx prisma migrate diff \
  --from-empty \
  --to-config-datasource \
  --script \
  -o prisma/migrations/0_init/migration.sql

```

*Verification:*
Check the first 25 lines of the generated file:

```bash
head -n 25 prisma/migrations/0_init/migration.sql

```

The file must begin with `CREATE TYPE` and `CREATE TABLE` definitions matching your existing database.

### Step 4: Register the Baseline as Applied

Tell Prisma that the development database already reflects `0_init` so it skips execution:

```bash
npx prisma migrate resolve --applied 0_init

```

---

## 3. Phase 2: Create & Apply Incremental Schema Changes

Now that the baseline matches the live database, generate migrations for new schema changes (e.g., indexes, cascades, new columns).

### Step 1: Generate Delta Migration

Run `migrate dev`. Prisma will detect only the differences between `0_init` and your current `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name apply_indexes_and_cascades

```

Prisma will:

1. Create a timestamped folder: `prisma/migrations/<timestamp>_apply_indexes_and_cascades/migration.sql`.
2. Apply the delta SQL immediately to the database.
3. Regenerate the Prisma Client.

### Step 2: Verify Local Status

```bash
npx prisma migrate status

```

*Expected Output:*

```text
2 migrations found in prisma/migrations
Database schema is up to date!

```

---

## 4. Phase 3: Deploy to Production (Zero-Downtime Synchronization)

Because the production database already contains baseline tables, running `prisma migrate deploy` directly will trigger error `P3018` when attempting to execute `0_init`. Follow this sequence to deploy safely.

### Step 1: Configure Connection to Production

Set your environment variables (in `.env` or temporary shell variables) to point to your **Production Direct Connection** (Port 5432):

```env
DATABASE_URL="postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

```

### Step 2: Resolve Baseline on Production First

Before running deployments, mark `0_init` as already executed on production:

```bash
npx prisma migrate resolve --applied 0_init

```

*Expected Output:*

```text
Migration 0_init marked as applied.

```

### Step 3: Deploy Incremental Changes

Execute the remaining unapplied delta migrations:

```bash
npx prisma migrate deploy

```

*Expected Output:*

```text
1 migration found in prisma/migrations
Applying migration `<timestamp>_apply_indexes_and_cascades`
The following migration has been applied: <timestamp>_apply_indexes_and_cascades
All migrations have been successfully applied.

```

### Step 4: Final Validation

```bash
npx prisma migrate status

```

*Expected Output:*

```text
Database schema is up to date!

```

---

## 5. Troubleshooting & Edge Cases

| Symptom / Error | Root Cause | Solution |
| --- | --- | --- |
| `Error: --to-schema-datasource was removed.` | Prisma 7 syntax change. | Use `--to-config-datasource` and `-o <path>` instead. |
| `Error: P3018 Migration failed to apply: type "..." already exists` | `prisma migrate deploy` tried to run `0_init` against an existing database. | Run `npx prisma migrate resolve --applied 0_init`, then rerun `npx prisma migrate deploy`. |
| `Drift detected: We need to reset the "public" schema` | Database has manual modifications not recorded in `prisma/migrations`. | Do not confirm reset. Run Phase 1 to capture drift into a baseline. |
| `P2028: Transaction API error: timeout` during operations | Queries inside interactive transactions are not using the `tx` client. | Audit interactive `$transaction` blocks to ensure every query executes on `tx`. |

---

## 6. Post-Migration Checklist

1. **Revert Dev Environment Variables:** Ensure local `.env` is restored to development credentials if temporarily switched to production.
2. **Commit Migration Artifacts:** Commit both `prisma/migrations/0_init` and `prisma/migrations/<timestamp>_apply_indexes_and_cascades` to version control.
3. **Regenerate Types:**
```bash
npx prisma generate

```


4. **Deploy Application Code:** Deploy the corresponding application code to Vercel production.