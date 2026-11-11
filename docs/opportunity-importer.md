# Academic opportunity importer

The importer reads explicitly supplied public source pages or feeds, uses Groq
to normalize records, writes a review JSON file, and only submits records after
explicit operator confirmation.

Implementation: [`scripts/opportunity-importer/import-opportunities.mjs`](../scripts/opportunity-importer/import-opportunities.mjs)

The importer implementation is intentionally kept local and ignored by Git.
Install or restore the files in `scripts/opportunity-importer/` before using
the npm commands in this document. Generated module-specific review files are
also ignored by Git.

## Supported modules

Each module has its own command, prompt, validation shape, and ScholarBase
create page:

| Command | Module | Create page |
| --- | --- | --- |
| `npm run import:academic-positions` | Academic positions | `/academic-positions/add` |
| `npm run import:admissions` | Admissions | `/admissions/add` |
| `npm run import:call-for-paper` | Call for papers | `/call-for-papers/add` |
| `npm run import:research-grants` | Research grants | `/grants/add` |

Courses and other modules are intentionally not included yet.

## Source-only workflow

The importer does not search the web and does not require Tavily. The
module-specific commands use these default sources:

| Module | Sources | Review output |
| --- | --- | --- |
| Academic positions | `servicesetu.org/jobs`, `servicesetu.org/programs/postdoc-positions` | `opportunity-review-academic-positions.json` |
| Admissions | `servicesetu.org/programs/phd-admission` | `opportunity-review-admissions.json` |
| Call for papers | `servicesetu.org/call-for-paper` | `opportunity-review-call-for-papers.json` |

Only records identified as still open and not past their deadline are written.
Records with closed, expired, filled, withdrawn, cancelled, or past-deadline
status are excluded.

```bash
npm run import:academic-positions
npm run import:admissions
npm run import:call-for-paper
```

These commands write separate files and do not apply records:

```text
opportunity-review-academic-positions.json
opportunity-review-admissions.json
opportunity-review-call-for-papers.json
```

Override the defaults by adding one or more sources with repeated `--source`:

```bash
npm run import:academic-positions -- \
  --source https://www.servicesetu.org/jobs \
  --source https://example.edu/university-jobs \
  --limit 5
```

ServiceSetu's client-rendered jobs page is supported through Playwright:

```bash
npm run import:academic-positions -- \
  --source https://www.servicesetu.org/jobs
```

For the other modules, supply authoritative pages or feeds for that specific
module:

```bash
npm run import:admissions -- --source https://example.edu/admissions
npm run import:call-for-paper -- --source https://example.edu/call-for-papers
npm run import:research-grants -- --source https://example.edu/grants
```

## Environment

```env
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
STAGING_EMAIL=...
STAGING_PASSWORD=...
STAGING_URL=https://staging.scholarbase.app
PRODUCTION_EMAIL=...
PRODUCTION_PASSWORD=...
PRODUCTION_URL=https://scholarbase.app
```

Keep `.env` out of commits and never pass passwords as command-line
arguments. `GROQ_MODEL` is optional and defaults to
`openai/gpt-oss-120b`.

Install the browser used for rendered sources and apply mode:

```bash
npm install
npx playwright install chromium
```

## Review

Review every generated record before applying it:

- Confirm the module and destination section.
- Confirm title, institution or organization, dates, deadlines, and links.
- Confirm the description contains only facts from the source.
- Remove duplicates and expired or unverifiable opportunities.
- Verify that the application link is authoritative.

The existing ScholarBase create actions publish immediately; they do not create
database drafts.

## Apply to staging

After reviewing the module-specific review file:

```bash
npm run import:opportunities -- \
  --module academic-position \
  --review opportunity-review-academic-positions.json \
  --apply \
  --confirm
```

Then type:

```text
APPLY
```

For a module-specific command, the module flag is already supplied:

```bash
npm run import:academic-positions -- \
  --review opportunity-review-academic-positions.json \
  --apply \
  --confirm
```

## Apply to production

Production uses separate credentials and a stronger confirmation:

```bash
npm run import:opportunities:production -- \
  --module academic-position \
  --review opportunity-review-academic-positions.json \
  --apply \
  --confirm-production
```

Type:

```text
PUBLISH TO PRODUCTION
```

Use the equivalent `--module admission`, `--module call-for-paper`, or
`--module research-grant` only after reviewing records for that module.

## Safety and errors

- Review mode never logs in or submits content.
- `--apply`, the confirmation flag, and the exact interactive phrase are all
  required.
- Source failures are reported and skipped so other sources can complete.
- The importer does not bypass authentication, access controls, or source
  restrictions.
- Keep batches small and verify the resulting records manually.
