# ScholarBase publishing gap register

This is the honest standard for the phrase “world class.” ScholarBase can
offer a better author/editor experience than a large publisher, but it cannot
claim to be equivalent to SAGE, Emerald, Elsevier, or Taylor & Francis until
the external registrations, preservation agreements, editorial evidence, and
production services below exist. Code is only one part of a scholarly
publisher.

## Current strengths

- Double-blind review access is enforced server-side, not only hidden in UI.
- Review files are immutable, hashed, private, and revision-aware.
- Publication is a guarded state transition with citation locators recorded in
  the same transaction as the `PUBLISHED` event.
- Conference-to-journal transfer clones the manuscript and preserves the
  original decision history.
- Venue, policy, edition, issue, program, cover, camera-ready, citation, and
  Zenodo workflows are represented as explicit records rather than free text.
- Public pages expose machine-readable citation metadata, RIS/BibTeX, JSON-LD,
  PDFs, and canonical URLs.
- Article submission captures bounded funding, data/code, ethics/consent,
  competing-interest, and AI-use declarations and publishes them with the
  article record.
- Rich text is sanitized on write and rendered through the shared `RichContent`
  boundary.

## P0 — required before calling the service a trustworthy publisher

### Corrections, retractions, and expressions of concern

The first implementation is now in place: append-only notices for correction,
retraction, and expression of concern are editor-created, sanitized, publicly
visible, and linked to the article. Published PDFs and citation records are not
overwritten. Remaining work is policy/legal review, explicit approval roles,
version labels, and propagating notice metadata into RIS/BibTeX and DOI
deposits.

### Editorial auditability

Reviewer invitations, reviewer recusal, editorial recusal, decisions, and
integrity notices now write immutable manuscript events. Publication metadata
edits and issue release still need dedicated events for complete administrative
auditability.

### Conflict-of-interest and recusal controls

Reviewers and editors can now declare a reasoned, manuscript-specific conflict.
Reviewers are blocked from reporting or deciding; editors are blocked from
assigning, deciding, publishing, or reviewing that manuscript. A reviewer
cannot be reassigned after recusal, and listed author/co-author emails are
blocked. Policy-driven adviser, same-institution, and automatic financial
matching still need a structured affiliation/conflict registry and
venue-specific policy settings.

### Preservation and continuity

Configure independent preservation (CLOCKSS, Portico, institutional repository,
or an equivalent service), define a succession/contact plan, and test restore.
Supabase backups alone are not a public preservation policy.

## P1 — required for credible indexing and discoverability

- Authenticated ORCID connection where an author claims ownership; the
  submission boundary now validates the ORCID checksum, but a typed ORCID is
  still not identity-verified.
- ROR identifiers for affiliations and structured funder/grant metadata.
- Explicit corresponding-author data is now stored with the structured byline;
  CRediT contributor roles are now captured per author. Funding,
  data/code availability, ethics approval, consent, competing-interest, and
  AI-use declarations and optional JEL classifications are now captured.
- Article-level version-of-record, accepted-manuscript, correction, and
  retraction metadata with stable relationships.
- JATS XML or another archival interchange format for published articles,
  alongside the PDF—not a replacement for the PDF.
- Accessibility acceptance criteria: tagged PDF, meaningful figure alt text,
  heading order, language metadata, and keyboard-accessible public pages.
- Crossref membership and deposits when the budget allows; Zenodo is a bridge,
  not a substitute for a publisher-controlled DOI landing page.

## P2 — competitive experience

- ORCID sign-in/import and author-controlled profile synchronization.
- Reviewer recognition only with explicit reviewer consent.
- Structured reviewer forms, rubric templates, reminders, substitute reviewer
  flow, and editor workload dashboards.
- Version comparison for revisions, author response letters, and decision
  templates with policy-specific required fields.
- Issue composition tools: article ordering, pagination validation, TOC export,
  XML/HTML/PDF package generation, and deposit preview.
- COUNTER-style usage reporting, article downloads, referral analytics, and
  transparent correction of bot traffic.
- Public editorial policies for peer review, authorship, complaints, appeals,
  misconduct, corrections, retractions, data, AI use, and accessibility.

## External and human gates

The following cannot be honestly “implemented” by a code change alone:

- ISSN/e-ISSN allocation and title consistency.
- ISBN allocation and the final copyright page.
- Crossref/DataCite membership and DOI deposits.
- Preservation agreement and restore drills.
- COPE-aligned policies, legal review, consent, and misconduct investigations.
- A real independent editorial board and documented editorial decisions.
- Reviewer recruitment, response-time evidence, acceptance/rejection statistics,
  and published corrections.
- Accessibility review by someone who uses assistive technology.

## Definition of done for launch

ScholarBase should not describe a venue as “world class” until the P0 items are
implemented and tested, the P1 metadata is complete for every published item,
the external gates have evidence attached, and a real end-to-end test has been
run in staging using the checklist in `docs/publishing-runbook.md`.
