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
| 6 | Article format | **PDF is the version of record; HTML carries metadata** | No PDF→HTML conversion; inline iframe viewer + `prose` metadata page |
| 7 | Conference → journal | **Clone the manuscript, never move the row** | Preserves the conference decision record; `originalManuscriptId` links them |
| 8 | Editorial board | **Structured rows (`EditorialBoardMember`), not HTML** | Feeds the ISSN application and JSON-LD without parsing HTML |
| 9 | Tables in prose | **Deferred** — see §20 | Empirical tables live in the PDF, which is the version of record |
| 10 | Reviewer count | **2 per manuscript** | Drives `dueAt` defaults and the "awaiting second review" copy |
| 11 | Year-1 proceedings | **Yes, a volume is published** | ISBN track is in scope this year, not deferred |
| 12 | Venue provisioning | **Narrow self-service form** at `/workspace/admin` | Create venue + publish toggle + role grant/revoke; no content CMS there |

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

An invitation is open when the **latest** event for `(manuscriptId, targetVenueId)` is `TRANSFER_INVITED` and no live clone exists. Declining therefore closes it without mutating history, and the editor may invite again. Only `ACCEPTED_PROCEDINGS` is invitable; an invitation created before the proceedings volume is published stays actionable after the source moves to `PUBLISHED`.

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
| Image upload | existing `uploadContentImageAction` / `content-images` bucket |

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
| Create venue | name (3–80, counter), slug (3–48, counter, auto-derived from the name until edited), type (`JOURNAL` / `CONFERENCE`) | `Venue` with `isPublished: false` — never published on creation |
| Publish / unpublish | per venue | `isPublished` + `launchedAt`; publishing is refused until the venue has a named editor-in-chief, aims & scope, at least one editorial board member, and a valid slug |
| Editorial roles | account email, role title (`EDITOR_IN_CHIEF`, `TRACK_CHAIR`, `ASSOC_EDITOR`) | `EditorialRole` row, idempotent upsert; revoke deletes it |

Choices the form **locks in permanently**, because no edit action exists:

- **Slug** is the public URL (`/sbj/<slug>` or `/sbc/<slug>`). Choose it deliberately; a typo means a dead URL, not a rename.
- **Type** cannot be changed. A conference is not promoted to a journal — that is what the transfer flow in §3 is for.

Rate limits (`enforceRateLimit`, per admin): 5 venue creations / 10 min, 20 publish toggles / 10 min, 30 role changes / 10 min.

**What the form does not do.** It creates *name, slug, type* and nothing else. Identifiers (ISSN/eISSN/ISBN), aims & scope, author guidelines, policies, the structured board, and the editor contact fields belong to the editor-in-chief on `/workspace/editorial/settings`, which is **not built yet** (phase 7 in §17). Until it exists, a venue cannot pass the publish gate, so provisioning currently produces unpublished venues only.

**Status.** Built: `/workspace/admin`, `createVenueAction`, `setVenuePublishedAction`, `grantEditorialRoleAction`, `revokeEditorialRoleAction`. Missing: `/workspace/editorial/settings`, and the public `/sbj/[slug]` / `/sbc/[slug]` pages — the `revalidatePath` on publish targets those routes ahead of their existence.

Routes:

- `/workspace/admin` — `User.isAdmin` only. See **Creating a journal or conference** above; it does not set identifiers.
- `/workspace/editorial/settings` — `EDITOR_IN_CHIEF` for that venue (**not built**). Tiptap for `aimsAndScope`, `authorGuidelines`, `peerReviewPolicy`, `ethicsPolicy`; repeatable-row form for `EditorialBoardMember`; structured `editorName` / `editorAffiliation` / `editorOrcid` / `frequency` / `contactEmail` fields. Identifiers (`issn`, `eissn`, `isbn`) are edited here, not in `/workspace/admin`.
- `/sbj/[slug]/guidelines`, `/sbc/[slug]/guidelines` — public, `RichContent` inside `prose` (**not built**).

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

---

## 11. DOI — why ₹0 cannot resolve on your own domain

A DOI resolves because `doi.org` looks up the prefix with a Registration Agency. The prefix `10.xxxxx` is allocated only by Crossref or DataCite. You cannot self-mint one, and self-hosting a resolver doesn't help — nobody resolves through your server.

| Route | Cost | Landing page | Verdict |
|---|---|---|---|
| **Crossref** (2026 low-volume tier) | **US$200/yr** for publishing revenue/expenses ≤ US$1,000, plus ~US$1 per article DOI | Yours | Target for year 2; what Scopus/DOAJ expect |
| DataCite direct member | €2,000/yr, no per-DOI fee | Yours | Overkill |
| **Zenodo** | Free | `zenodo.org/records/…` | Interim only |
| ARK / PURL | Free | Yours | Legitimate in libraries, not in citation manager workflows |

**Interim plan:** stable canonical URLs + `citation_public_url`, `Manuscript.doi` nullable with `doiStatus`, and a Zenodo deposit recorded in `zenodoDepositId`. When Crossref is affordable, add the prefix and backfill `doi` — no schema change.

**Build Crossref-ready metadata now, pay later.** A deposit needs title, ordered authors with affiliations/ORCID, abstract, page range, licence URL, and ISSN on a resolving landing page — the article page has all of it. The only schema additions are `Manuscript.coAuthors` and `Venue.licenseUrl`.

The mint route (`/api/publishing/mint-doi`) must be idempotent: persist `doiStatus` **and** `zenodoDepositId` before/after the call, and never deposit twice on retry. Zenodo will happily create a duplicate.

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
/workspace                           protected shell, sidebar from EditorialRole
/workspace/submissions               author timeline
/workspace/submissions/new           invited extended-version submission
/workspace/editorial                 publish an accepted paper; invite a conference author to a journal
/workspace/editorial/settings        EiC venue CMS
/workspace/admin                     venue provisioning (gated on `User.isAdmin`)
```

Not built (documented, no route yet): the reviewer split screen
(`/workspace/reviews/[taskId]`) and the decision Kanban. Reviewer assignment and
decisions currently exist as Server Actions and `ManuscriptEvent` writes; the
public site only shows `PUBLISHED` papers, so their absence does not affect it.

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

## 14. Reviewer suggestion (one embedding call, no new pipeline)

- Endpoint: `POST /api/workspace/reviewer-suggestions` — editor-only, rate-limited, returns 10 candidates.
- Embeds the abstract with `embedTexts` from `src/lib/semantic/model.ts` (singleton, 384-d MiniLM) and runs a `<=>` raw query against the existing `User.embedding` HNSW index, modelled on `findSimilarScholars` in `src/lib/semantic/matching.ts`.
- Excludes the author, existing reviewers, and declared conflicts.
- **Build gotcha:** `next.config.ts` traces ONNX binaries only for `/api/cron/embed-content`. A Server Action or page importing `transformers` works in `next dev` and dies in the Docker image. Add `/api/workspace/reviewer-suggestions` to `outputFileTracingIncludes` (and the matching excludes).
- Fallback: if the model fails to load, rank by venue keywords so the modal is never a dead end.

---

## 15. Opportunity ETL (build last)

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
| 5 | `/workspace/reviews/[taskId]` + review action | issue 1 |
| 6 | `/sbj/[slug]` + article page + RIS + JSON-LD + Highwire | issue 1 |
| 7 | `/workspace/admin` provisioning + `/workspace/editorial/settings` (Tiptap) | ISSN application |
| 8 | **Publish issue 1 → apply for ISSN** | DOAJ |
| 9 | `/workspace/editorial` Kanban + reviewer suggestions | scale |
| 10 | `/sbc/[slug]` + proceedings volume + ISBN | — |
| 11 | Opportunity ETL staging pipeline | — |
| 12 | Crossref application (budget permitting) | indexing |
| 13 | HTML full text — **deferred**, see §20 | — |

Sitemap sharding is independent and can land any time after phase 1.

**Where it stands:** phases 1–4 are in place, plus `/workspace/admin` (provisioning half of phase 7) and an `ACCEPTED_PROCEDINGS` invite queue on `/workspace/editorial`. Not built: review workspace (5), public `/sbj` and `/sbc` pages (6, 10), `/workspace/editorial/settings` (the other half of 7), and phases 8–13.

---

## 18. What not to do

- Do not add `dnd-kit` anywhere except the editorial Kanban leaf.
- Do not add `ai` / `@ai-sdk/google`, `pdf.js`, KaTeX, or a Markdown toolbar library — capabilities already exist or are deferred.
- Do not auto-convert PDF→HTML.
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
