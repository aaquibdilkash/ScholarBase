# Seeding Journals from OpenAlex — Hybrid (attributed to your ScholarBase account)

## Overview

This script bulk-imports journals from **OpenAlex** and attributes them to your **ScholarBase user account**. Each journal is created with `authorId` = your user ID, your `journalCount` is incremented, activity log entries are created, and followers receive notifications — exactly as if you had added each journal manually via `/journals/add`.

## Prerequisites (run once)

### 1. Add environment variables to `.env`

```env
# Optional but recommended — gives you $1/day budget and 30 req/s vs $0.10/day & 10 req/s keyless
OPENALEX_API_KEY=your_openalex_free_key_here

# Required — set by the Supabase/Docker setup for this project
DATABASE_URL=postgres://user:password@host:port/db
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 2. Install dependencies (once)

```bash
npm install
# ensures `pg` (built-in to Node 22+) is available
```

### 3. Verify your ScholarBase email

The email you pass must be associated with a Supabase auth user that exists in your project.

## Usage

### A. Dry-run (safe — no database writes)

Prints what would happen: how many journals pass/reject by quality gate, rejection reasons, and estimated cost.

```bash
node scripts/seed-openalex-journals.cjs --dry-run --user-email you@scholarbase.app
```

**Example output:**

```
✅ Found ScholarBase user ID: c1234567-89ab-cdef-0123-456789abcdef

Total fetched: 120452 | Accepted: 38215 | Rejected: 8237
Rejection reasons:
  noISSN: 12
  invalidISSNChecksum: 45
  duplicateISSN: 3987
  lowWorks: 2341
  stale: 1203
  preprintRepo: 189
  type: 23
💰 Estimated cost: $0.24 (free key / keyless)

📋 Journals would be attributed to user ID: c1234567-89ab-cdef-0123-456789abcdef
   (Use --live to actually import, with --user-email to set the account)
```

### B. Live import (actual DB writes)

Imports journals attributed to your account. Two modes:

**Pilot (recommended first run — safe budget usage):**

```bash
node scripts/seed-openalex-journals.cjs --live --limit 500 --user-email you@scholarbase.app
```

**Full import (all that fit your budget):**

```bash
node scripts/seed-openalex-journals.cjs --live --user-email you@scholarbase.app
```

The script stops when the `--max-cost` limit is reached (default: unlimited, i.e. stops only when budget exceeds $1 if you set `--max-cost 1`).

## What happens during a live import

For each journal that passes the quality gates:

| Action | Detail |
|---|---|
| **Journal created** | `authorId` = your ScholarBase user ID; all OpenAlex fillable fields populated (title, ISSN, publisher, website, subjectArea, openAccess status, worksCount, citedByCount, hIndex, doajListed) |
| **Your `journalCount`** | Incremented by 1 (inside a Prisma transaction) |
| **Activity log** | `"PUBLISHED"` entry created under your user activity |
| **Follower notification** | Followers receive "ScholarBase added a new journal" notification (same pattern as manual journal creation) |
| **Cache purged** | `journals-public` tri-split tag purged → `/journals` list updates immediately |
| **DB sizes printed** | `pg_total_relation_size`, `pg_indexes_size`, `pg_relation_size` for the Journal table |

### Quality gates (what gets accepted/rejected)

| Gate | Condition | Rejection reason |
|---|---|---|
| **ISSN present** | `issn_l` must exist | `noISSN` |
| **ISSN valid** | 8-char checksum must pass | `invalidISSNChecksum` |
| **No duplicates** | ISSN or OpenAlex ID not already in your `Journal` table | `duplicateISSN` |
| **Minimum works** | `works_count >= 50` | `lowWorks(N)` |
| **Active since 2024** | `last_publication_year >= 2024` | `stale(N)` |
| **Not a preprint repo** | `is_preprint_repository` must be false | `preprintRepo` |
| **Type check** | `type` must be `journal` | `type=X` |

**Accepted journals** come from OpenAlex with ISSN, valid checksum, at least 50 works, and first publication year >= 2024. Duplicates against your existing `Journal` rows are silently skipped.

## Post-seed: Fill Scopus/ABDC/SJR fields (one-time)

The seed script leaves `scopusQuartile`, `abdcRanking`, `sjrQuartile`, and `sjrScore` as `NULL`. These are free external lists you can cross-match after the seed:

| List | Source (free) | Column updated | How |
|---|---|---|---|
| **Scopus Source List** | https://www.elsevier.com/data/bibliometric-tools/scopus-source-list | `scopusQuartile` (NONE\|Q1\|Q2\|Q3\|Q4) | Join on `Journal.issn_l` |
| **ABDC Journal Quality List** | https://www.abdc.edu.au/journal-list | `abdcRanking` (NONE\|A\*\|A\|B\|C) | Join on `Journal.issn_l` |
| **SCImago Journal Rank** | https://www.scimagojr.com/ | `sjrQuartile`, `sjrScore` | Join on `Journal.issn_l` |
| **Web of Science** | Proprietary (no free API) | `wosIndex` | Add a manual toggle on the journal detail page, or import your institution's WoS subscription list |

**To run the post-seed updates (after the seed script):**

```bash
# Example — I will provide these scripts after you confirm the seed works:
node scripts/update-scopus.js          # reads scopus-source-list.csv
node scripts/update-abdc.js            # reads abdc-journal-list.csv
node scripts/update-scimago.js         # reads scimago-journal-rank.csv
```

Download the three CSV files from the links above and save them as `scripts/scopus-source-list.csv`, `scripts/abdc-journal-list.csv`, `scripts/scimago-journal-rank.csv` in your project.

## File locations

| File | Purpose |
|---|---|
| `scripts/seed-openalex-journals.cjs` | The hybrid seed script (this run) |
| `docs/seed-openalex-journals.md` | This documentation |
| `scripts/scopus-source-list.csv` | Scopus list (download from Elsevier, save here) |
| `scripts/abdc-journal-list.csv` | ABDC list (download from abdc.edu.au, save here) |
| `scripts/scimago-journal-rank.csv` | SCImago list (download from scimagojr.com, save here) |

## When to use what

| Scenario | Command |
|---|---|
| **Check how many would be imported** (safe, no DB writes) | `node scripts/seed-openalex-journals.cjs --dry-run --user-email you@scholarbase.app` |
| **Import a pilot of 500 journals** (safe budget usage) | `node scripts/seed-openalex-journals.cjs --live --limit 500 --user-email you@scholarbase.app` |
| **Import all that fit your budget** | `node scripts/seed-openalex-journals.cjs --live --user-email you@scholarbase.app` |
| **After import — fill Scopus quartiles** | `node scripts/update-scopus.js` (after saving the CSV) |
| **After import — fill ABDC rankings** | `node scripts/update-abdc.js` (after saving the CSV) |
| **After import — fill SJR quartiles/scores** | `node scripts/update-scimago.js` (after saving the CSV) |
