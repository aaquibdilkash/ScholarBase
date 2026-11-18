# ScholarBase Publishing — Runbook & Build Spec

Journals (`/sbj`), conferences (`/sbc`), the editorial workspace, ISSN/ISBN registration, DOI strategy, and the opportunity ETL.

This file is the single reference for both the registration process and the implementation. Where it conflicts with `AGENTS.md`, `AGENTS.md` wins on engineering rules; this file wins on publishing process.

---

## 1. Locked decisions

| # | Decision | Choice | Consequence |
|---|---|---|---|
| 1 | Publisher of record | **ScholarBase imprint**, operated as a **sole proprietorship** under Udyam | ISSN needs no entity; ISBN needs PAN + Udyam; liability is personal until a Pvt Ltd exists |
| 2 | Launch scope | **1 journal + 1 conference public**, 2 + 2 seeded for testing | Venue config must be DB-driven from day one; test venues stay `isPublished: false` |
| 3 | Budget | **₹0 for identifiers** | ISSN free, ISBN free, DOI deferred to Crossref's US$200 tier |
| 4 | Kanban | **`dnd-kit`** accepted | 3 packages, client-only, imported in the editorial leaf |
| 5 | Venue CMS | **Existing Tiptap `Editor` + `RichContent`** | Store HTML strings; sanitize on write and on render |
| 6 | Publishing covers | **Existing `content-images` bucket** | Venue, edition, and issue covers use separate folder kinds; no new bucket |
| 7 | Article format | **PDF is the version of record; HTML carries metadata** | No PDF→HTML conversion; inline iframe viewer + `prose` metadata page |
| 7 | Conference → journal | **Clone the manuscript, never move the row** | Preserves the conference decision record; `originalManuscriptId` links them |
| 8 | Editorial board | **Structured rows (`EditorialBoardMember`), not HTML** | Feeds the ISSN application and JSON-LD without parsing HTML |
| 9 | Tables in prose | **Deferred** — see §20 | Empirical tables live in the PDF, which is the version of record |
| 10 | Reviewer count | **2 per manuscript** | Drives `dueAt` defaults and the "awaiting second review" copy |
| 11 | Year-1 proceedings | **Yes, a volume is published** | ISBN track is in scope this year, not deferred |
| 12 | Venue provisioning | **Narrow self-service form** at `/workspace/admin` | Create venue + publish toggle + role grant/revoke + delete an empty unpublished venue; the content CMS lives at `/workspace/editorial/settings` |

---

## 2. Roles and permissions

| Role | Scope | Can |
|---|---|---|
| `SUPER_ADMIN` | Platform | Provision venues, set `isPublished`, edit any venue content, mint/re-mint DOI, all editor powers |
| `EDITOR_IN_CHIEF` | One venue | Edit venue content (aims, guidelines, board), final decisions, publish, invite an accepted conference paper to a journal they hold no seat on |
| `TRACK_CHAIR` | One venue/conference | Assign reviewers, accept to proceedings, originate the transfer invitation |
| `ASSOC_EDITOR` | One venue | Assign reviewers, recommend decisions — cannot publish or transfer |
| Author | Own manuscripts | Submit, withdraw before acceptance, resubmit after `REVISION_REQUIRED` |
| Reviewer | Assigned tasks only | Submit score + inline comments; **never** sees author identity |

Enforcement rules:

- Every Server Action resolves the user with `getActiveUser()` (frozen accounts get `{ success: false, message }`, not a thrown error).
- `SUPER_ADMIN` via the existing `isUserAdmin` (`src/lib/auth.ts`) — **resolve before opening `prisma.$transaction`**, never inside.
- Venue role lookup is a single indexed query on `[userId, venueId]`; no per-row role checks in lists.
- Blinding is enforced in the **query select**, not the component: reviewers never receive `authorId`, `author`, or co-author fields.
- All writes call `enforceRateLimit({ onDegraded: "closed" })`.

---

## 3. The Golden Flow

```
                ┌──────────────────────────────────────────────┐
                │  CONFERENCE (Venue.type = CONFERENCE)        │
                └──────────────────────────────────────────────┘
  SUBMITTED ──▶ UNDER_REVIEW ──▶ REVISION_REQUIRED ──▶ UNDER_REVIEW
                     │                                      │
                     ├──▶ REJECTED (terminal)               │
                     └──▶ ACCEPTED_PROCEDINGS ─────────────┤
                                     │                    │
                TRACK_CHAIR / EiC "Invite to Journal"     │
                                     ▼                    │
                ┌──────────────────────────────────────────────┐
                │  AUTHOR receives TRANSFER_INVITED event      │
                │  (notification + /workspace/submissions)     │
                └──────────────────────────────────────────────┘
                                     │ author consents and submits
                                     ▼
                ┌──────────────────────────────────────────────┐
                │  JOURNAL (Venue.type = JOURNAL)              │
                │  NEW manuscript row:                         │
                │    status       = SUBMITTED                  │
                │    venueId      = target journal             │
                │    originalManuscriptId = conference id      │
                │    round        = 0                          │
                └──────────────────────────────────────────────┘
                                     ▼
  SUBMITTED ──▶ UNDER_REVIEW ──▶ REVISION_REQUIRED ──▶ ACCEPTED_JOURNAL ──▶ PUBLISHED
```

Why a new row and not a move (`venueId` update + status reset, as originally proposed): moving the row erases the conference's acceptance decision, the reviewer identities that made it, and the reviewed file. That is the exact provenance an integrity-sensitive platform cannot lose. Under the author-initiated model the author creates the new row, so the journal submission is also an explicit act of consent — the conference editor can only invite.

### Implemented paths

| Step | Where | Written |
|---|---|---|
| Conference editor invites | `/workspace/editorial` → `inviteAuthorToJournalAction` | `TRANSFER_INVITED` on the conference paper (`targetVenueId`) |
| Author declines | `/workspace/submissions` → `declineTransferInvitationAction` | `TRANSFER_DECLINED`, same pair |
| Author accepts | `/workspace/submissions/new?invitation=<eventId>` → `createManuscriptSubmissionAction` | new `Manuscript` (`SUBMITTED`, `originalManuscriptId`) + `ManuscriptFile` + `SUBMITTED` event, plus `TRANSFERRED` on the conference paper |
| Author submits directly | `/workspace/submissions/new?venue=<slug>` (linked from every public venue page) → `createDirectSubmissionAction` | new `Manuscript` (`SUBMITTED`) + `ManuscriptFile` + `SUBMITTED` event; editor-in-chief and track chairs are notified |

Direct submission is the path that makes a serial real: a published journal or
conference receives its first paper without an invitation chain. It refuses an
unpublished or demo venue, and it refuses an author who holds an editorial seat
at that venue — the person who decides a paper must not be the person who
submitted it.

### Workflow notifications

All notices are in-app rows queued through `notifyUserById` (delivery is the
existing digest/email pipeline, never a synchronous send).

| Event | Recipient | Link target |
|---|---|---|
| Editor invites an extended version | the author | the conference submission |
| Author accepts and submits | the inviting editor **and** the target journal's EiC / Track Chairs | the editorial desk |
| Author declines | the inviting editor | the editorial desk |
| Author submits directly | the venue's EiC / Track Chairs | the editorial desk |
| Editor assigns a reviewer | that reviewer | the paper's review workspace |
| Reviewer submits a report | every seat holder at the venue except the reviewer | the paper's review workspace |
| Editor records a decision | the author | the author's submission |
| Author withdraws | every seat holder at the venue | the paper's review workspace |
| Manuscript published | the author | the published submission (with its public article link) |
| Venue published / unpublished | every role holder at that venue | the editorial desk |
| Editorial role granted | the new editor | the editorial desk |

Target types in `src/lib/notification-links.ts`: `manuscript` → the author's
`/workspace/submissions/<id>`, `editorial` → the desk, and `editorialManuscript`
→ that paper's review workspace. `notifyUserById` is a no-op when the recipient
is the actor, and duplicate recipients are de-duplicated before queueing.

The reviewer's report event is written with **no actor id** on purpose: the
author's timeline shows that a report landed and the decision letter, never the
reviewer's name. Reviewer identity lives only on `ReviewTask`, which the author
cannot read.

An invitation is open when the **latest** event for `(manuscriptId, targetVenueId)` is `TRANSFER_INVITED` and no live clone exists. Declining therefore closes it without mutating history, and the editor may invite again. Only `ACCEPTED_PROCEDINGS` is invitable; an invitation created before the proceedings volume is published stays actionable after the source moves to `PUBLISHED`.

---

### Review workspace

One route serves both audiences, gated per capability
(`src/lib/publishing/access.ts`):

- **Desk** (`EDITOR_IN_CHIEF`, `TRACK_CHAIR`, `ASSOC_EDITOR`, or platform admin):
  sees every report with reviewer names, may assign a reviewer, and may record a
  decision from the options the state machine and their seat allow.
- **Assigned reviewer**: sees their own report form only. They need no editorial
  seat; the route and `/api/manuscripts/[id]/file` both admit them by
  `ReviewTask` row for the current round.

Assigning the first reviewer writes `REVIEW_ASSIGNED` and moves `SUBMITTED` →
`UNDER_REVIEW` in one transaction (conditional on the status that was read, so
two editors cannot double-transition). A report stores `score` (1–10),
`decision`, and the prose in `inlineComments`, then appends `REVIEW_SUBMITTED`
with **no actor** so the author's timeline stays anonymous. A decision appends
`STATUS_CHANGED` with the decision letter as its note and notifies the author.

A decision can never set `PUBLISHED` here: that belongs to the publication panel
(§3), which records the citation locator in the same write. The decision action
refuses acceptance or rejection without at least one completed report, and
requires a decision letter for a rejection.

The reviewer's report is `inlineComments: [{ body }]` — the stored note shape
with no page anchor. `reviewReportBody` reads it, and also tolerates a bare
string from any earlier row.

---

## 4. Status machine (single source of truth)

Implemented as `src/lib/publishing/transitions.ts` — a plain map, no database calls, unit-tested.

| From | Allowed to | Actor |
|---|---|---|
| `SUBMITTED` | `DESK_REJECTED`, `UNDER_REVIEW`, `WITHDRAWN` | Editor / Author |
| `UNDER_REVIEW` | `REVISION_REQUIRED`, `ACCEPTED_PROCEDINGS`, `ACCEPTED_JOURNAL`, `REJECTED` | Editor |
| `REVISION_REQUIRED` | `UNDER_REVIEW` (round + 1), `WITHDRAWN` | Author resubmits, Editor re-enters review |
| `ACCEPTED_PROCEDINGS` | `PUBLISHED` (proceedings volume), *invite* → author may create a new `SUBMITTED` journal row | Track Chair / EiC |
| `ACCEPTED_JOURNAL` | `PUBLISHED` | EiC |
| `PUBLISHED` | *(terminal)* — corrections are new versions, not status changes | — |
| `DESK_REJECTED`, `REJECTED`, `WITHDRAWN` | *(terminal)* | — |

`WITHDRAWN` is missing from the original spec and is required: authors must be able to withdraw before acceptance, and the record must survive.

Author withdrawal is a **separate predicate** (`canAuthorWithdraw`), not an edge
in the table above. The editorial table's invariant is "nothing reaches
`PUBLISHED` without review"; author consent is a different question, and the
common case — pulling a paper during review — is an edge the editor-facing
table deliberately does not have. Withdrawal is allowed from `SUBMITTED`,
`UNDER_REVIEW`, and `REVISION_REQUIRED`; `STATUS_ACTOR_ROLES.WITHDRAWN` stays
empty, so no editor can withdraw a paper on an author's behalf.

`decideManuscriptAction` refuses `PUBLISHED` outright: `publishManuscriptAction`
is the only writer of that status because it also records the volume, issue, and
pages. Any other route to `PUBLISHED` would create the empty archive entry an
ISSN reviewer rejects.

A transfer is **not a status transition**. The conference editor writes one
`TRANSFER_INVITED` event (`ManuscriptEvent.targetVenueId`); the author then
creates a new journal manuscript with `originalManuscriptId` set. Only
`ACCEPTED_PROCEDINGS` is invitable — a rejected paper has no acceptance decision
to extend.

Every transition writes one `ManuscriptEvent` row in the same transaction: `{ manuscriptId, type, actorId, fromStatus, toStatus, note, createdAt }`. That table is the author timeline, the audit log, and the transfer provenance — no second history table.

---

## 5. Data model

See `prisma/schema.prisma` and `prisma/migrations/20261117120000_publishing_core/migration.sql`.

```prisma
enum VenueType           { JOURNAL CONFERENCE }
enum ManuscriptStatus    { SUBMITTED DESK_REJECTED UNDER_REVIEW REVISION_REQUIRED
                           ACCEPTED_PROCEDINGS ACCEPTED_JOURNAL PUBLISHED REJECTED WITHDRAWN }
enum EditorialRoleTitle  { EDITOR_IN_CHIEF TRACK_CHAIR ASSOC_EDITOR }
enum ReviewDecision      { ACCEPT MINOR_REVISION MAJOR_REVISION REJECT }
enum ManuscriptEventType { SUBMITTED STATUS_CHANGED REVIEW_ASSIGNED REVIEW_SUBMITTED
                           REVISION_UPLOADED TRANSFER_INVITED TRANSFER_DECLINED
                           TRANSFERRED PUBLISHED WITHDRAWN }
enum DoiStatus           { NONE PENDING MINTED FAILED }
```

Models: `Venue`, `Manuscript`, `ManuscriptFile`, `ReviewTask`, `EditorialRole`, `EditorialBoardMember`, `ManuscriptEvent`.

Design notes:

- **No `totalVotes` / `totalBookmarks` / `totalComments`.** Manuscripts are a workflow entity, not social content. Do **not** register them in `ENTITY_CONFIG` (`src/lib/transactions.ts`), `CONTENT_TABLES` (`src/lib/module-registry.ts`), or the tri-split registry. Only `PUBLISHED` manuscripts get a public page, read through their venue.
- **No `Manuscript.embedding`.** Reviewer suggestion embeds the abstract on demand in one model call. Adding a vector column means a trigger, an outbox entity type, a text builder, and a worker branch — four files to maintain for one editor-only action.
- **`ManuscriptFile` replaces a `fileUrl` on `Manuscript`.** A revision must never overwrite the file that was reviewed; `sha256` proves which version was assessed.
- **`Manuscript.isbn` holds the ISBN of the proceedings volume** the paper appears in. When a `ProceedingsVolume` model lands (phase 10), this field becomes a relation with a backfill.
- `updatedAt` moves on any write; use `publishedAt` / `ManuscriptEvent.createdAt` for display dates.

---

## 6. Storage, uploads, and viewing (security-critical)

A public `Manuscript.fileUrl` is unsafe: it leaks unpublished manuscripts and defeats double-blind review.

### Enable the bucket (once per environment)

```bash
npm run storage:manuscripts
```

The script (`scripts/setup-manuscripts-bucket.mjs`) is idempotent: it creates the private `manuscripts` bucket, or repairs its policy if it already exists. It reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`) from the environment, then `.env.local`, then `.env`. Run it before the first submission; without it the upload ticket action returns "Manuscript uploads are not configured yet."

Staging and production are **different Supabase projects**, so the script runs once per project. The repo's `.env` carries the staging URL but an **empty** `SUPABASE_SERVICE_ROLE_KEY`, so the default command cannot create a bucket. Source the environment snapshot instead:

```bash
# staging
set -a; . ./cool_staging.env; set +a
npm run storage:manuscripts

# production
set -a; . ./cool_prod.env; set +a
npm run storage:manuscripts
```

Process environment wins over `.env`, so the snapshot's URL and service key are the ones used. The script prints the target project URL first — read it before trusting the result. For local development against staging, put the staging service-role key in `.env.local` (never commit it).

The script sets `public = false`, a 25 MB limit, and `application/pdf` as the only allowed MIME type. Those numbers mirror `src/lib/publishing/constants.ts` — change both or neither. It creates **no** storage policies: uploads and downloads go through signed URLs only.

The running app also needs `SUPABASE_SERVICE_ROLE_KEY` (`SUPABASE_SERVICE_KEY` is accepted as a legacy alias): the upload ticket and the post-upload verification both use the service role. `next build` does not need it; the runtime container does.

### Upload flow

- Upload goes **browser → Supabase via a signed upload URL**. A Server Action cannot carry a PDF: `next.config.ts` sets `serverActions.bodySizeLimit: "6mb"`, and buffering a 30 MB PDF through a 2-core VPS is the wrong trade.
- `createManuscriptUploadUrlAction` issues the ticket and returns only a server-generated path under `users/<userId>/manuscripts/<uuid>.pdf` plus a token. A client never names its own path.
- The browser computes `sha256` with `crypto.subtle` before upload. `createManuscriptSubmissionAction` re-reads the object with the service role: `info()` must report `application/pdf` and a size within the 25 MB ceiling, `download()` is hashed and must equal the submitted digest, and the declared byte count must match.
- A failed verification deletes the object only when no `ManuscriptFile` references that path. An upload abandoned before submission stays unreferenced: it is never served (no public URL exists), and a later sweep can collect it.
- Only an open invitation can be consumed. The clone insert runs at Serializable isolation and re-checks for a live clone, so a double submit produces one row and one "already with that journal" message.
- Read access: the server component mints a short-lived signed URL **only after** the permission check.
- Public PDF only after `PUBLISHED`: copy to a public `publications` bucket (or serve via an authorized route) and reference that path in `citation_pdf_url`.
- The review viewer needs a **CSP change**: `src/lib/csp.ts` allows `frame-src https://challenges.cloudflare.com` only and sets `object-src 'none'`. Add the Supabase origin (`SUPABASE_HTTP_ORIGIN`, already derived there) to `frame-src`, or the PDF pane renders blank with no visible error.
- Keep `object-src 'none'`. Use `<iframe>`, not `<object>`/`<embed>`.

---

## 7. Venue content management (Tiptap)

Reuse, do not rebuild:

| Need | Use |
|---|---|
| Authoring | `src/components/ui/Editor.tsx` (Tiptap, `value`/`onChange`, `maxLength`, `showCharCount`, `onImageUpload`) |
| Rendering | `src/components/content/RichContent.tsx` — the app's **only** `dangerouslySetInnerHTML` sink |
| Sanitizing | `src/lib/sanitize.ts` → `sanitizeRichHtml` |
| Image upload | existing `uploadContentImageAction` / `content-images` bucket; `venue-cover`, `conference-cover`, and `journal-cover` folder kinds |

Hard rules:

1. **Never** write `dangerouslySetInnerHTML` in a venue page. `<RichContent content={venue.authorGuidelines} />` already handles sanitizing, `prose` typography, dark mode, and the image lightbox.
2. **Sanitize on write too**, in the Server Action, before `prisma.venue.update`. "Only editors can write this" is not an XSS defence — an editor can paste from Word, and an editor account can be compromised.
3. **No tables in the CMS.** `Editor` installs StarterKit + Image only; `sanitizeRichHtml` has no table tags in its allowlist. Board listings use `EditorialBoardMember` rows, not HTML. See §20.
4. Venue content fields are bounded: pass `maxLength` and `showCharCount` (repo form-UX rule) and validate server-side with the same constant.
5. `sanitizeRichHtml` deliberately strips `class` and `style`. Do not relax the allowlist to fix a layout problem — fix the CSS.

### Creating a journal or conference — where the form is

**Route: `/workspace/admin`.** It is the only place a `Venue` row can be created, and it is a page in the workspace shell — not a modal, and deliberately not part of `/workspace/editorial/settings`.

**Who can open it:** a user whose `User.isAdmin` is `true` (`isUserAdmin()` in `src/lib/auth.ts`). No UI grants that flag and `EditorialRole` does **not** — it is a deliberate database change:

```sql
update "User" set "isAdmin" = true where lower(email) = lower('<operator email>');
```

Run it against staging and production separately, then sign out and back in. Anyone else who opens the URL is redirected to `/` by `src/app/workspace/admin/page.tsx`; every action behind it calls `requireAdmin()` and throws, so the page guard is convenience, not the security boundary.

**What the page does.** Three cards from `src/components/workspace/VenueAdminPanel.tsx`:

| Card | Fields | Writes |
|---|---|---|
| Create venue | name (3–80, counter), slug (3–48, counter, auto-derived from the name until edited), type (`JOURNAL` / `CONFERENCE`), optional cover upload | `Venue` with `isPublished: false` — never published on creation |
| Publish / unpublish | per venue | `isPublished` + `launchedAt`; publishing is refused until the venue has a named editor-in-chief, aims & scope, at least one editorial board member, and a valid slug |
| Editorial roles | account email, role title (`EDITOR_IN_CHIEF`, `TRACK_CHAIR`, `ASSOC_EDITOR`) | `EditorialRole` row, idempotent upsert; revoke deletes it |

Choices the form **locks in permanently**, because no edit action exists:

- **Slug** is the public URL (`/sbj/<slug>` or `/sbc/<slug>`). Choose it deliberately; a typo means a dead URL, not a rename.
- **Type** cannot be changed. A conference is not promoted to a journal — that is what the transfer flow in §3 is for.

Rate limits (`enforceRateLimit`, per admin): 5 venue creations / 10 min, 20 publish toggles / 10 min, 30 role changes / 10 min.

**What the form does not do.** It does not set identifiers (ISSN/eISSN/ISBN), aims & scope, author guidelines, policies, the structured board, or editor contact fields. Those belong to the editor-in-chief on `/workspace/editorial/settings`. Until those are filled in, the publish gate refuses the venue, so provisioning alone produces unpublished venues. The settings page is organized into **General**, **Policies**, and **Editions/Issues** tabs.

**Status.** Built: `/workspace/admin`, `createVenueAction`, `setVenuePublishedAction`, `grantEditorialRoleAction`, `revokeEditorialRoleAction`, `/workspace/editorial/settings` (venue CMS + board + identifiers), and the public `/sbj` / `/sbc` site.

Routes:

- `/workspace/admin` — `User.isAdmin` only. See **Creating a journal or conference** above; it does not set identifiers.
- `/workspace/editorial/settings` — `EDITOR_IN_CHIEF` for that venue. **General** contains identity, contact, board, and venue cover; **Policies** contains Tiptap for `aimsAndScope`, `authorGuidelines`, `peerReviewPolicy`, and `ethicsPolicy`; **Editions** or **Issues** contains the selected venue's publishing records. Identifiers (`issn`, `eissn`, `isbn`) are edited here, not in `/workspace/admin`.
- `/sbj/[slug]/guidelines`, `/sbc/[slug]/guidelines` — public, `RichContent` inside `prose`.

`EditorialRole` grants nothing on `/workspace/admin`; that is platform-level only.

---

## 8. Article page: PDF as version of record, HTML for metadata

Do **not** convert PDF→HTML. `unpdf` yields text without figures, tables, or section structure — a worse artefact that you then own forever, and a CPU cost on a 2-core box.

| Surface | Implementation |
|---|---|
| Full text | Inline `<iframe>` with a signed/public PDF URL, plus a "Download PDF" link |
| Metadata | Server-rendered `prose` block: title, authors + affiliations, abstract, keywords, licence, dates |
| Citation export | **Route Handler**, not a Server Action: `GET /sbj/[slug]/article/[id]/citation.ris` |
| Structured data | `ScholarlyArticle` JSON-LD via `serializeJsonLd` + `<JsonLd>` |
| Indexing | Highwire `<meta>` tags through `metadata.other` |

Why a Route Handler for the `.ris`: a Server Action cannot set `Content-Disposition`, and Zotero/Mendeley/Google Scholar fetch citation files by URL. `TY  - JOUR` for journal articles, `TY  - CONF` for proceedings; `SN` carries ISSN/ISBN, `DO` the DOI, `UR` the canonical URL built from `SITE_URL` (`@/constants/seo` — note `absoluteUrl` in `src/lib/seo.ts` is private, not exported).

**Required Highwire tags** (Google Scholar will not index without `citation_pdf_url`):

```
citation_title, citation_author (repeat per author), citation_publication_date,
citation_journal_title | citation_conference_title, citation_issn | citation_isbn,
citation_pdf_url, citation_abstract_html_url, citation_doi,
citation_volume, citation_issue, citation_firstpage, citation_lastpage, citation_language
```

Also emit `Organization` / `Periodical` JSON-LD on `/sbj/[slug]` with `issn` and `publisher`.

### Accessibility (author guidelines, not the renderer)

HTML full text is deferred (§20), so accessibility is pushed into the submission requirements. Put these in `Venue.authorGuidelines` and `Venue.authorGuidelines` defaults:

- Submit a **tagged/accessible PDF** — Word: "Save as accessible PDF"; LaTeX: `\DocumentMetadata` with `pdfstandard=a-2b`.
- Supply **alt text** for every figure in the submission form.
- Mark **header rows** in tables.
- State the licence (CC BY 4.0) inside the document.
- Use real heading styles, not bold text, for section titles.

This covers most of what HTML full text would have bought on the accessibility axis, at zero build cost, and is exactly what ISSN reviewers and DOAJ look for.

---

## 9. ISSN — what it is, what it needs, how to get it

**Issuer:** National Centre for ISSN, India — National Science Library, CSIR-NIScPR, 14 Satsang Vihar Marg, New Delhi 110067. Online application through `nsl.niscpr.res.in/ISSNPROCESS/issn.jsp`.

Facts that matter:

- **Free. No agents or brokers** — the centre states this explicitly. Any service charging for ISSN is a scam.
- **One ISSN per title per medium.** An online-only journal gets an **e-ISSN** only. A later print edition is a second ISSN.
- **No legal entity required.** An individual publisher with a stable address qualifies — which is why the journal can launch before any company exists.
- **The serial must already exist.** For online-only titles the centre expects a live site and at least a first issue. An empty archive is the most common rejection reason.

Pre-application checklist:

- [ ] Title checked for collisions on `portal.issn.org` **before** branding
- [ ] Stable public URL for the venue
- [ ] Named Editor-in-Chief **with affiliation**
- [ ] Editorial board with names and affiliations
- [ ] Aims & scope
- [ ] Stated frequency
- [ ] Peer-review process described concretely (single/double blind, reviewer count, timeline)
- [ ] Author guidelines
- [ ] Ethics, misconduct, and retraction policy (COPE-aligned; COPE guidelines are free)
- [ ] Contact address and email on the site
- [ ] Publisher name visible on the site
- [ ] **Issue 1 published** with a table of contents (2–3 articles is enough)

After allocation:

- [ ] ISSN on the venue footer, the about/guidelines page, and every article page
- [ ] Stored in `Venue.issn` and emitted as `citation_issn`
- [ ] Never change the venue URL without notifying the centre

**Timeline:** weeks, not days. Apply as soon as issue 1 is live; expect one round of "please add X to your site" feedback. Re-verify the process at `nsl.niscpr.res.in` when applying — portals change.

**Zero-cost sequencing:** journal first (ISSN only, no entity needed) → conference as a call for papers that transfers into the journal → ISBN only when a standalone proceedings volume is produced.

---

## 10. ISBN — what it is, what it needs, how to get it

**Issuer:** Raja Rammohun Roy National Agency for ISBN (RRRNA), Department of Higher Education, Ministry of Education — `isbn.gov.in`. Free. The portal was redesigned; new applicants register fresh.

| Route | Needs | Fits |
|---|---|---|
| **Commercial Publisher** | PAN (proprietor's PAN is fine for a sole proprietorship) + Udyam / firm registration + address proof | ScholarBase as an imprint |
| **Institutional Publisher** | A university / college / department willing to be publisher of record | Free, more credible, but hands them editorial control |

### Udyam first (free, ~20 minutes)

- Aadhaar + PAN, self-declared, no fee, no CA.
- NIC code for publishing of journals and periodicals.
- **Register the name exactly once, as it will appear everywhere** — Udyam certificate, ISSN record, ISBN record, site footer, article PDFs.
- A sole proprietorship means **unlimited personal liability**. The certificate is not protection; the contracts are (§12).

### What actually gates ISBN

Not registration — **the book existing**. You need a finalized title, editor(s), publication date, page count, and format before applying.

Correct order:

1. Conference concludes
2. Finalize the volume (editors, contents, pagination)
3. **Apply for ISBN**
4. Put the ISBN on the **copyright page**
5. Generate the final PDF
6. Publish

Apply *after* the PDF is final and you either re-typeset or ship a volume whose copyright page contradicts its own ISBN.

Other constraints:

- ISBN is **per title per edition**. Volume 1 (2026) and Volume 2 (2027) each need their own.
- The ISBN must be **printed inside** the work, not just on the website.
- Each assigned ISBN must be reported back with its metadata.
- **Delivery of Books (Public Libraries) Act 1954** obliges publishers of printed works to deposit copies with the designated national libraries. For a digital-only volume, ask the agency rather than assuming it's waived.

### Proceedings: ISBN per volume, ISSN for the series, or both

If the conference recurs under a stable title with a stated frequency ("Proceedings of the ScholarBase Conference on …"), the **series** can hold an ISSN while each **volume** holds an ISBN. Both are free, both together is normal and more citable. Recommended for an annual conference.

### Conference editions (annual, half-yearly, or quarterly)

`Venue` is the permanent conference series. Each real event is a
`ConferenceEdition` with one stable key and one proceedings volume/ISBN:

| Event pattern | Edition keys |
|---|---|
| Annual | `2027`, `2028` |
| Twice yearly | `2027-h1`, `2027-h2` |
| Four events | `2027-q1`, `2027-q2`, `2027-q3`, `2027-q4` |

The public URL is `/sbc/{venue-slug}/{edition-key}`. The series page remains
the permanent home; the edition page owns its CFP state, deadlines, event
details, accepted papers, and proceedings. A quarterly review deadline feeding
one annual event is not four editions — it is one edition with multiple rounds,
which is a later model.

Operational sequence:

1. In Editorial → Venue settings, create the actual edition and assign its proceedings volume and ISBN.
2. Set `CFP_OPEN` and Public when submissions should be accepted. The submission form requires an edition for conferences.
3. Move it through review, notification, and program states; publish only after the public page is ready.
4. Publish accepted papers. The edition’s volume and ISBN are copied to each paper for fast citations.
5. After the event, set `COMPLETED`; keep the record public and immutable apart from corrections.

There is no normal legacy-edition workflow. A compatibility edition exists only
when an older manuscript already references it. Empty generated compatibility
editions are removed by the cleanup migration; new conferences start with no
edition until the editor creates one.

The edition workspace also maintains the event metadata (dates, timezone,
location, website, cover image, CFP deadline, notification date, and camera-ready deadline)
and an optional program of keynotes, talks, papers, posters, workshops, and breaks. The
public edition page exposes the program separately from the proceedings list.
An edition cannot move to `COMPLETED` without a proceedings volume, and status
changes follow the forward lifecycle rather than allowing arbitrary jumps.

---

## 11. DOI — Zenodo now, Crossref later

A DOI resolves because `doi.org` looks up the prefix with a Registration Agency. The prefix `10.xxxxx` is allocated only by Crossref or DataCite. You cannot self-mint one, and self-hosting a resolver doesn't help — nobody resolves through your server.

| Route | Cost | Landing page | Verdict |
|---|---|---|---|
| **Crossref** (2026 low-volume tier) | **US$200/yr** for publishing revenue/expenses ≤ US$1,000, plus ~US$1 per article DOI | Yours | Target for year 2; what Scopus/DOAJ expect |
| DataCite direct member | €2,000/yr, no per-DOI fee | Yours | Overkill |
| **Zenodo** | Free | `zenodo.org/records/…` | Interim only; **implemented** |
| ARK / PURL | Free | Yours | Legitimate in libraries, not in citation manager workflows |

**The limitation to state plainly:** a Zenodo DOI lands on the Zenodo record, not on ScholarBase. Only a Crossref/DataCite membership lets us register our own landing page. The deposit metadata therefore links back to the article in two places: a `related_identifiers` entry with `relation: isIdenticalTo` and a "Version of record" link in the description. Do not promise an author that `doi.org/<doi>` opens this site.

### How minting works

Built as `src/lib/publishing/{zenodo,doi-metadata}.ts` + `src/app/actions/doi.ts`, surfaced by `DoiPanel` on `/workspace/editorial/manuscripts/[id]`. Only the Editor-in-Chief (or a platform admin) can mint, and only on a `PUBLISHED` article. The desk's **Recently published** list is the way back into a paper after it leaves the accepted queue.

The flow uses Zenodo's legacy deposit API (`create → upload → metadata → publish`) because it needs no DataCite account:

```
POST /api/deposit/depositions                     id + links.bucket
PUT  {bucket}/{filename}                          the PDF version of record
PUT  /api/deposit/depositions/{id}                { metadata }
POST /api/deposit/depositions/{id}/actions/publish
GET  /api/deposit/depositions/{id}                state, doi, record_url
```

Idempotency is enforced in the action, not in Zenodo — Zenodo will happily create a duplicate deposit:

1. `Manuscript.doi` set → return success, no network call.
2. Claim the row by writing `doiStatus = PENDING` **before** the first outbound request.
3. Persist `zenodoDepositId` immediately after `create`.
4. On retry, `GET` that deposit: if it is already `submitted`, record its DOI; otherwise upload only missing files, re-put metadata, and publish.
5. Any failure records `FAILED`; the panel offers **Retry minting**, which resumes the same deposit.

A fresh `PENDING` row is another editor's in-flight request. A `PENDING` row older than two minutes is treated as a crashed run and is safe to resume because the deposit id is reused. A crash between `PENDING` and `create` leaves no deposit id; that row is also reclaimable.

### Environment

| Variable | Meaning |
|---|---|
| `ZENODO_TOKEN` | Personal token with `deposit:write` + `deposit:actions`. Blank disables minting without breaking published articles. |
| `ZENODO_SANDBOX` | `true` uses `sandbox.zenodo.org` (test DOI prefix `10.5072`). |
| `ZENODO_API_URL` | Optional full API base override (proxy or self-hosted sandbox). |

The mint action needs the service-role key to read the private PDF bucket, and `npm run storage:manuscripts` must have created the `manuscripts` bucket.

### What the publisher does in Zenodo

Register once as the publisher/operator of the ScholarBase Zenodo account;
authors do not need separate Zenodo accounts for the automated path.

1. Create or use a Zenodo account and verify its email.
2. Open **Applications** and create a personal access token with exactly
   `deposit:write` and `deposit:actions`. Keep it private and use it only over
   HTTPS. [Zenodo API quickstart](https://developers.zenodo.org/)
3. Put the token in the server environment as `ZENODO_TOKEN` — never in client
   code, logs, `.env.example`, or Git.
4. Set `ZENODO_SANDBOX=true` and use a sandbox token for one test article.
   Confirm the PDF, authors, license, canonical ScholarBase link, and DOI.
5. Set `ZENODO_SANDBOX=false` and replace the token with the production token.
   The editor publishes the ScholarBase article first, opens its DOI panel, and
   chooses **Mint Zenodo DOI**.
6. Check the returned record once. Retries resume the same deposit id; do not
   manually create a second Zenodo record.

Zenodo assigns the DOI when the record is published, not when a draft is
created. Corrections should use a new version or an appropriate restriction or
note rather than silently replacing the published record. [Zenodo upload
guidance](https://help.zenodo.org/docs/deposit/create-new-upload/) The DOI
resolves to Zenodo; Crossref/DataCite is still required later if the DOI itself
must resolve to ScholarBase.

### Metadata mapping

`buildDoiMetadata` is pure and tested:

- `upload_type: publication`, `publication_type: article | conferencepaper`
- creators in `Family, Given` order with affiliations and bare ORCID iDs
- abstract escaped into Zenodo's allowed HTML subset
- licence from `Venue.licenseUrl` (`cc-by-4.0` by default); an unrecognised licence becomes `other-open`, never a false CC label
- `journal_title`, `journal_volume`, `journal_issue`, `journal_pages`, `issn` for journals
- `conference_title`, `isbn` for proceedings
- publication date, keywords, publisher (`imprint_publisher`), and the canonical article URL as `isIdenticalTo`

Once `Manuscript.doi` is written, the public article page, Highwire `citation_doi`, RIS/BibTeX downloads, and JSON-LD render it with no further work.

**Crossref migration:** when the membership is affordable, add the prefix and backfill `doi` (and `zenodoDepositId` for the provenance trail). No schema change is needed. The old plan for an `/api/publishing/mint-doi` route was dropped in favour of a Server Action; there is no public mint endpoint.


---

## 12. Non-code prerequisites before issue 1

| Item | Why | Cost |
|---|---|---|
| Udyam registration | ISBN route; stable imprint name | ₹0 |
| Submission agreement | Author warrants originality, grants licence, indemnifies publisher | ₹0 |
| Licence | CC BY 4.0 is the DOAJ-friendly default | ₹0 |
| Ethics & retraction policy | ISSN reviewers, DOAJ, basic liability protection | ₹0 |
| Plagiarism attestation at submission | Similarity Check is unaffordable now — an explicit warranty + editorial spot-check is the honest substitute | ₹0 |
| Named Editor-in-Chief who answers email | Both agencies look for a real person | ₹0 |
| Preservation plan | DOAJ requires long-term preservation | ₹0 to declare |

Liability note: as publisher you own copyright intake, defamation exposure, and retraction handling. The IT Act §79 intermediary safe harbour is thin for content you select and edit. Not legal advice — but the submission agreement and policy pages are the actual protection, not the entity type.

---

## 13. Public pages and SEO

### Routes

Built today (all of these exist in `src/app/`):

```
/sbj                                 journal directory
/sbj/[slug]                          journal home (ISSN, board, current issue)
/sbj/[slug]/guidelines               aims, author guidelines, ethics (RichContent)
/sbj/[slug]/archive                  every issue as a table of contents
/sbj/[slug]/article/[id]             article landing page: metadata, abstract, PDF, RIS/BibTeX, JSON-LD
/sbc                                 conference directory
/sbc/[slug]                          conference home (dates, committee, proceedings)
/sbc/[slug]/guidelines               submission guidelines
/sbc/[slug]/archive                  published papers and volumes
/sbc/[slug]/article/[id]             paper landing page
/sbc/[slug]/proceedings/[volume]     collected volume with the ISBN copyright block
/api/papers/[id]/file                302 to a 60-second signed PDF URL
/api/papers/[id]/cite?format=ris|bibtex
/workspace                           redirects to /workspace/submissions
/workspace/submissions               author's manuscripts + open invitations
/workspace/submissions/[id]          one submission: authors, abstract, files, event timeline, withdraw
/workspace/submissions/new           direct submission (`?venue=<slug>`) or invited extended version (`?invitation=<eventId>`)
/workspace/editorial                 desk: papers awaiting action, your review queue, publish, transfer invite
/workspace/editorial/board           decision board: one column per stage, safe triage moves
/workspace/editorial/manuscripts/[id] one paper's review workspace: assign reviewers, reports, decision, DOI
/workspace/editorial/settings        EiC venue CMS
/api/manuscripts/[id]/file           302 to a signed PDF for the author, its reviewers, and the desk
/workspace/admin                     venue provisioning (gated on `User.isAdmin`)
```

The decision board is a view, not a second state machine. Columns come from
`src/lib/publishing/board.ts`; a card offers only the reversible
`UNDER_REVIEW ⇄ REVISION_REQUIRED` / `SUBMITTED → UNDER_REVIEW` moves that the
actor's seat can set, and accepted cards link to the publication panel rather
than publishing from a click. No drag-and-drop dependency was added; the writes
go through `decideManuscriptAction`.

Next 16: `params` is a `Promise` — `const { slug } = await params`. Metadata via `buildMetadata` (`src/lib/seo.ts`); add a thin scholarly wrapper rather than duplicating it.

### Indexing discipline

- `Venue.isPublished === false` → `buildNoindexMetadata`, excluded from the sitemap, excluded from nav. Otherwise empty test venues read as thin/soft-404 content and can drag site-level quality signals.
- Do not put placeholder journal titles on the production domain; once crawled they linger.

### Sitemap sharding

Current state: `src/app/sitemap.ts` (force-dynamic, 24 h `unstable_cache`) + `src/lib/sitemap.ts` (50k cap, 45k warning). Replace the single-file cap with shards:

- Next 16 passes `props.id` as a **`Promise<string>`** and serves `/sitemap/[id].xml` — v14/v15 snippets do not compile here.
- **Shard by module, not by `skip`/`take`.** `skip` shifts as rows are inserted, so a URL can appear in two shards or none. Give each content module a stable shard id and page it with `cursor: { id }` ordered by `id`.
- Cap 10,000 per file (well under the 50,000 protocol limit) and keep `unstable_cache` at 24 h on the counts.
- Verify after implementation that `/sitemap.xml` still serves the index of shards.
- Keep the 45,000 warning log; it is now per shard.

---

## 14. Reviewer suggestion (built: stated interests, no model call)

Built as `src/lib/publishing/reviewer-suggestions.ts`, rendered inside the
`AssignReviewerPanel` on `/workspace/editorial/manuscripts/[id]`.

- Candidates come from `User.interests` — the free-text field each scholar fills
  in themselves — ranked by how many of the manuscript's keywords appear in it.
  One query (a single `OR` over the keywords, `take: 40`), ranked in memory, top
  5. No embedding, no new route, no round trip: the page already has the
  keywords, so the shortlist is server-rendered with it.
- Excludes the author, existing reviewers, frozen/deleted accounts, and anyone
  with zero overlap. The editor still picks; the action still refuses the author,
  the assigning editor, and a duplicate assignment.
- Wording is deliberately modest ("from stated research interests", "matches
  optics"). Interest text is self-declared, not evidence of expertise, and the UI
  must not imply otherwise.
- Upgrade path (not built): embed the abstract with `embedTexts` and rank on
  `User.embedding` as `findSimilarScholars` does. That needs the ONNX tracing
  fix first — `next.config.ts` traces the model only for
  `/api/cron/embed-content`, so a page importing `transformers` works in
  `next dev` and dies in the Docker image. Do not add it without that change.

---

## 15. Opportunity ETL (not built — do not scaffold the table early)

Status: nothing exists. No model, no migration, no route. A staging table with
no reader, no writer, and no admin screen is dead schema, and the project rule
is to delete before adding.

Do **not** write AI-extracted rows into public content tables.

- New `OpportunityDraft` staging table with `status` (`PENDING` / `APPROVED` / `REJECTED` / `DUPLICATE`), `sourceUrl`, `fetchedAt`, `rawMarkdown`, `payload` (JSON), `reviewedBy`.
- Ingest via `r.jina.ai` with `X-Return-Format: markdown`, a hard timeout, a byte cap, and a domain allowlist. Cache `rawMarkdown` so re-parsing never re-fetches.
- Extract with a plain `fetch` to the Gemini REST API + Zod validation. **Do not add `ai` + `@ai-sdk/google`** — two fast-moving dependencies for one call per night.
- **Dedupe with `pg_trgm` first** (already installed for search): normalized title similarity + `findUnique` on `sourceUrl` catches the overwhelming majority at ~zero CPU. Only fall back to embeddings for the residue.
- Human promotion: an admin approves a draft, and a single transaction inserts it into the correct existing module — `CallForPaper`, `AcademicPosition`, `ResearchGrant`, or `Admission` — which already have votes, moderation, search, tri-split lists, and sitemap entries. Do not create a fifth parallel opportunity corpus.
- Auth: `verifyCronSecret()` (`src/lib/cron.ts`, timing-safe). **Delete the dead `import:opportunities` scripts** in `package.json` — `scripts/opportunity-importer/` does not exist.

---

## 16. Tests and CI gates

Pure modules, unit tier (`npm test`, no DB):

- `test/publishing/identifiers.test.ts` — ISSN mod-11 (weights 8…2, `10 → X`), ISBN-13 check digit, normalization
- `test/publishing/transitions.test.ts` — every allowed edge, and that every illegal edge is rejected
- `test/publishing/permissions.test.ts` — reviewer blinding, role matrix, `TRACK_CHAIR` cannot publish
- `test/publishing/sanitize.test.ts` — `<script>`, `onerror`, `javascript:`, pasted `style`/`class` stripped from venue content
- `test/publishing/reviews.test.ts` — assignment refusals (no seat, author, self, duplicate), the SUBMITTED → UNDER_REVIEW opening, report validation, the anonymous `REVIEW_SUBMITTED` event, decision refusals (no report, no letter, illegal edge, `PUBLISHED`), the lost-race path, and interest ranking
- `test/publishing/manuscripts.test.ts` — direct/invited submission, publish, **and author withdrawal** (author only, not after acceptance, not when published, desk notified)
- `test/publishing/zenodo.test.ts` — sandbox/production host resolution, token-free upload target, empty-`202` publish read-back, attached-file listing, bare DOI normalization
- `test/publishing/doi-metadata.test.ts` — journal vs conference-paper schema, creator/ORCID mapping, HTML escaping, licence mapping, canonical `isIdenticalTo`
- `test/publishing/doi.test.ts` — mint-once, already-minted short-circuit, resume of a submitted deposit, `FAILED` on error, non-published/non-EiC/no-PDF refusals, unconfigured degradation, concurrent-claim refusal
- `test/publishing/board.test.ts` — column mapping, published/withdrawn excluded, and the safe one-click move set per seat

Integration tier (`test/integration/**`, loopback Postgres only):

- Transfer clones the manuscript, sets `originalManuscriptId`, leaves the conference row untouched, writes one `ManuscriptEvent`
- Review submission updates the task and writes exactly one event
- Double-mint is a no-op when `zenodoDepositId` exists

Finish every change with `npm run lint && npm run typecheck && npm run test:coverage`, plus `npm run build` for routing changes. Do not lower coverage thresholds.

---

## 17. Build order

| Phase | Work | Blocks |
|---|---|---|
| 0 | Udyam registration; agree imprint name | ISBN only |
| 1 | Migration: `Venue`, `Manuscript`, `ManuscriptFile`, `ReviewTask`, `EditorialRole`, `EditorialBoardMember`, `ManuscriptEvent` | everything |
| 2 | `src/lib/publishing/{identifiers,transitions,permissions}.ts` + tests | actions, UI |
| 3 | Storage: private bucket, signed upload, SHA-256, CSP `frame-src` | submissions, reviews |
| 4 | `/workspace/submissions` + submit action | issue 1 |
| 5 | `/workspace/editorial/manuscripts/[id]` + assign/report/decide actions | issue 1 |
| 6 | `/sbj/[slug]` + article page + RIS + JSON-LD + Highwire | issue 1 |
| 7 | `/workspace/admin` provisioning + `/workspace/editorial/settings` (Tiptap) | ISSN application |
| 8 | **Publish issue 1 → apply for ISSN** | DOAJ |
| 9 | Reviewer suggestions (**done**, §14); editorial Kanban (**done** in `board.ts` + `/workspace/editorial/board`) | scale |
| 10 | `/sbc/[slug]` + proceedings volume + ISBN | — |
| 11 | Opportunity ETL staging pipeline | — |
| 12 | Crossref application (budget permitting); Zenodo minting (**done**, §11) | indexing |
| 13 | HTML full text — **deferred**, see §20 | — |

Sitemap sharding is independent and can land any time after phase 1.

**Where it stands:** phases 1–7, the review workspace (5), reviewer
suggestions (9), the decision board (9), Zenodo DOI minting (11), and 10 are in
place. The workspace shell, author submission flow (direct and invited), review
workspace (assign → report → decide), author withdrawal, publish/transfer
actions, the venue CMS with identifiers and board, and the public `/sbj` and
`/sbc` sites all exist.

Not built: the opportunity ETL (11), Crossref (12 — the schema and the Zenodo
bridge exist; a Crossref prefix is a paid membership), and HTML full text (13,
deferred by §20).

Phase 5 is a route change from the original spec: the reviewer split screen is
`/workspace/editorial/manuscripts/[id]`, not `/workspace/reviews/[taskId]`.
Editors and reviewers need the same page (title, abstract, PDF, timeline) and
differ only in which sections they may see, so one route with a capability check
beats two routes with duplicated context.

---

## 18. What not to do

- Do not add `dnd-kit` anywhere except the editorial Kanban leaf.
- Do not add `ai` / `@ai-sdk/google`, `pdf.js`, KaTeX, or a Markdown toolbar library — capabilities already exist or are deferred.
- Do not auto-convert PDF→HTML.

## 18.1 Staging test checklist

Use this sequence after creating fresh staging venues. Keep both venues
unpublished until their public preview is complete.

### Reset and provision

1. Confirm the staging database/project before deleting any test rows.
2. Create one `JOURNAL` and one `CONFERENCE` at `/workspace/admin`.
3. Upload a cover for each venue; verify preview, replace, and remove work.
4. Grant yourself `EDITOR_IN_CHIEF` for both venues.

### Configure the venue

1. Open `/workspace/editorial/settings` and select the venue.
2. In **General**, set the name, editor, frequency, contact, board, and cover.
3. In **Policies**, enter rich text in all four policy fields, use “Use default”
   once, save, reload, and verify the HTML is preserved and sanitized.
4. Confirm the **Editions** tab appears for a conference and **Issues** appears
   for a journal; the unrelated form must not be shown.

### Conference test

1. Create an edition using `2027`, `2027-h1`, or `2027-q3`.
2. Upload an edition cover and verify it appears in the preview/public edition.
3. Test invalid HTTPS URLs, DOI values, dates, and duplicate edition keys.
4. Move the edition through `DRAFT → CFP_OPEN → REVIEW → NOTIFICATION → PROGRAM → COMPLETED`.
5. Add optional program entries: keynote, invited talk, paper, poster, workshop,
   break, and other. Verify time, room, track, speakers, and external link.
6. Confirm completion is refused without a proceedings volume.
7. Confirm conference submissions require the selected edition.

### Journal test

1. Create an issue with volume, number, title, rich description, publication
   date, DOI, and cover upload.
2. Save the issue, reload, replace/remove the cover, and edit the rich text.
3. Test duplicate volume/issue numbers and invalid DOI/cover input.
4. Move the issue through `DRAFT → OPEN → LOCKED → PUBLISHED` and verify the
   public archive and issue page.
5. Confirm accepted journal articles inherit the issue citation metadata.

### End-to-end editorial test

1. Submit a PDF directly to the conference edition.
2. Assign two reviewers, submit reports, request revision, resubmit, and accept.
3. Upload camera-ready, publish the proceedings paper, and verify volume/ISBN,
   public page, citation export, and Highwire metadata.
4. Invite the author to the journal; accept the invitation and verify a new
   journal manuscript is created without moving the conference manuscript.
5. Review and publish the journal article into the created issue.
6. Verify notifications, author timeline, reviewer blinding, and unauthorized
   access for every private PDF.

### Zenodo sandbox test

1. Set `ZENODO_SANDBOX=true` and provide a sandbox token with only
   `deposit:write` and `deposit:actions`.
2. Publish one article first; then use its DOI panel to mint a Zenodo DOI.
3. Verify the PDF, authors, abstract, licence, issue/volume or ISBN, canonical
   ScholarBase link, and returned DOI.
4. Retry the same action and confirm no duplicate deposit is created.
5. Only after the full sandbox test passes, switch to the production token and
   `ZENODO_SANDBOX=false`.

### Release gate

- [ ] Venue identity, editor, board, policies, contact, and cover are complete.
- [ ] Venue remains unpublished until the public preview is correct.
- [ ] Every published article has a verified PDF, citation metadata, and public page.
- [ ] Conference proceedings have final volume/ISBN metadata before completion.
- [ ] Journal issue has final publication date, contents, and DOI decision.
- [ ] Zenodo is tested in sandbox; production token is never committed or exposed.
- [ ] Run `npm run lint`, `npm run typecheck`, and `npm run test:coverage` before release.
- Do not store a public `fileUrl` for an unpublished manuscript.
- Do not register `Manuscript` in `ENTITY_CONFIG` / `CONTENT_TABLES` / tri-split.
- Do not hand-roll `dangerouslySetInnerHTML` — use `RichContent`.
- Do not relax `sanitizeRichHtml`'s allowlist to allow `class`/`style`.
- Do not mint DOIs without an idempotency key.
- Do not write ETL output into public content tables.
- Do not apply for ISBN before the volume is typeset, or for ISSN before issue 1 is live.

---

## 19. Resolved questions

1. **Reviewer count:** 2 per manuscript. The workflow needs a "awaiting second review" state on the editorial Kanban, and `ReviewTask.dueAt` defaults to 21 days from assignment.
2. **Year-1 proceedings:** yes, a volume is published. ISBN work is in scope this year — finalize the volume, apply for ISBN, print it on the copyright page, then generate the final PDF (see §10). `ProceedingsVolume` should be modelled in phase 10 rather than leaving ISBN on `Manuscript` indefinitely.
3. **Venue provisioning:** narrow self-service at `/workspace/admin` — create venue, publish toggle, grant/revoke roles. Publishing is guarded: a venue needs an editor-in-chief, aims & scope, and at least one board member before it can be indexed.
4. **Transfers are author-initiated:** a conference `TRACK_CHAIR`/EiC invites,
   the author consents and submits, and the receiving editor runs the normal
   `SUBMITTED → UNDER_REVIEW` gate. The actor is hard-blocked from inviting into
   any venue where they hold a role. Chair-side clone/push was rejected: it
   creates duplicate submissions, self-dealing, and papers in a journal queue
   that their author never agreed to submit.
5. **PDF only at submission; no DOCX.** Reviewed 2026-11-17 and reaffirmed. A PDF is a fixed rendering, so it is the version of record and the file a reviewer can read inline; DOCX reflows per application, can carry tracked changes, comments, and OLE objects, and its MIME is a claim inside a ZIP rather than a fact `verifyManuscriptObject` can check. Converting server-side would mean headless LibreOffice (~700 MB, ARM64) rendering author-supplied archives on the same 2-core box. The author-facing cost is one menu item (`File → Save as → PDF` in Word, `Download → PDF` in Google Docs).
   Deferred, not rejected: accept DOCX as an *optional supplementary source* file (`ManuscriptFile.kind` is already free text, so no migration) while the PDF stays the version of record. That needs bucket `allowedMimeTypes` widened on **both** Supabase projects via `npm run storage:manuscripts`, a second extension in `MANUSCRIPT_PATH_PATTERN`, a second upload in `ManuscriptSubmissionForm`, and review-UI copy that never implies DOCX is reviewable.

---

## 20. Deferred: HTML full text

**Trigger to build:** a DOI/indexing body requires it, accessibility becomes a contractual requirement, or published articles exceed ~50 and HTML is measurably driving traffic. Not before.

**Why deferred:** Google Scholar indexes `citation_pdf_url`, not your HTML. Empirical papers need tables *and* equations; the PDF already typesets both correctly, while HTML needs a sanitizer allowlist change plus MathML/KaTeX. On a 2-core ARM box that is weeks of work to render a worse version of an artefact you already have.

**When triggered:**

1. DOCX → HTML via `mammoth` (already a dependency). LaTeX authors stay PDF-only; say so in the guidelines.
2. Extend `sanitizeRichHtml` with `table, thead, tbody, tr, th, td, caption` and `colspan`, `rowspan`, `scope` — never `style` or `class`.
3. Add a test proving `<script>` inside a cell is still stripped and `javascript:` in a `th` is still blocked.
4. Handle mobile overflow of wide regression tables. A `transformTags` wrapper div would need a class, which reopens the UI-redressing surface closed in P1-4 — prefer a CSS-only wrapper or a `data-*` attribute.
5. Equations: MathML from the converter first. KaTeX/MathJax is a last resort.
6. Schema: nullable `Manuscript.htmlBody @db.Text` — one migration, no redesign.
