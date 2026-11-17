import Link from "next/link";

import { RichContent } from "@/components/content/RichContent";
import {
  VenueImprint,
  VenueMasthead,
  VenueSection,
  displayIssn,
  venueBasePath,
} from "@/components/publishing/VenueMasthead";
import type { PublicVenue } from "@/lib/publishing/public";

/**
 * Policies and author guidance.
 *
 * Stored venue content (`authorGuidelines`, `peerReviewPolicy`, `ethicsPolicy`)
 * is rendered first when present. The blocks below it describe how this
 * platform actually operates — two independent reviewers, a fixed PDF as the
 * version of record, no author charges — so the page is never an empty shell
 * while the CMS fields are still unfilled.
 */

function PolicyList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="space-y-4 text-sm">
      {items.map(([term, description]) => (
        <div key={term}>
          <dt className="font-medium text-slate-900 dark:text-slate-100">{term}</dt>
          <dd className="mt-1 leading-6 text-slate-600 dark:text-slate-400">
            {description}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function VenueGuidelinesPage({ venue, preview }: { venue: PublicVenue; preview: boolean }) {
  const isJournal = venue.type === "JOURNAL";
  const base = venueBasePath(venue.type);
  const issn = displayIssn(venue.issn);
  const eissn = displayIssn(venue.eissn);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <VenueMasthead
        venue={venue}
        preview={preview}
        activeTab="guidelines"
        trail="Author guidelines"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-6">
          {venue.authorGuidelines ? (
            <VenueSection title="Author guidelines">
              <RichContent content={venue.authorGuidelines} />
            </VenueSection>
          ) : null}

          <VenueSection
            title="How manuscripts are handled"
            description="The process every submission goes through."
          >
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600 dark:text-slate-400">
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Editorial assessment.
                </span>{" "}
                The editor-in-chief checks scope, completeness, and originality.
                A manuscript outside scope or missing required material is
                returned without review.
              </li>
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Independent peer review.
                </span>{" "}
                At least two reviewers assess each manuscript. Reviewers are
                asked to declare competing interests and to keep the manuscript
                confidential.
              </li>
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Decision.
                </span>{" "}
                The editor decides to accept, request revision, or reject, and
                communicates the decision with the reviewers&rsquo; comments.
              </li>
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Revision.
                </span>{" "}
                A revised manuscript is re-assessed by the editor and, where the
                revision is substantial, by the original reviewers.
              </li>
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Publication.
                </span>{" "}
                The accepted PDF becomes the version of record, the article
                receives its volume, issue, and page range, and it appears in the
                archive.
              </li>
            </ol>
          </VenueSection>

          {venue.peerReviewPolicy ? (
            <VenueSection title="Peer-review policy">
              <RichContent content={venue.peerReviewPolicy} />
            </VenueSection>
          ) : null}

          <VenueSection
            title="Licensing and copyright"
            description="What authors keep and what readers may do."
          >
            <PolicyList
              items={[
                [
                  "Author copyright",
                  "Authors retain copyright in their work. Publication grants ScholarBase a non-exclusive licence to publish, archive, and distribute the version of record.",
                ],
                [
                  "Reader licence",
                  venue.licenseUrl
                    ? "Articles are published open access under Creative Commons Attribution 4.0 (CC BY 4.0): anyone may read, share, and adapt the work with attribution."
                    : "Articles are published open access. The licence is stated on each article page.",
                ],
                [
                  "Version of record",
                  "The published PDF is the definitive version. It is not silently replaced; corrections are issued as separately dated notices.",
                ],
              ]}
            />
          </VenueSection>

          <VenueSection
            title="Charges"
            description="What publication costs an author."
          >
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              There are no submission charges, no article processing charges, and
              no page charges. Reading and downloading are free. If that changes,
              the fee schedule will be published on this page before it applies
              to any manuscript.
            </p>
          </VenueSection>

          {venue.ethicsPolicy ? (
            <VenueSection title="Publication ethics">
              <RichContent content={venue.ethicsPolicy} />
            </VenueSection>
          ) : null}

          <VenueSection
            title="Research integrity"
            description="Expectations that apply to every submission."
          >
            <PolicyList
              items={[
                [
                  "Originality and plagiarism",
                  "Submitted work must be original, must not be under consideration elsewhere, and must cite prior work it builds on. Text recycling from the authors' own earlier publications must be disclosed.",
                ],
                [
                  "Authorship",
                  "Everyone listed as an author must have contributed substantively and approved the submitted version. Gift, guest, and ghost authorship are not accepted. AI tools cannot be listed as authors.",
                ],
                [
                  "AI assistance",
                  "The use of generative AI for drafting, translation, or code must be disclosed in the manuscript. Authors remain fully responsible for the accuracy of every claim and reference.",
                ],
                [
                  "Data and reproducibility",
                  "Where a study generates data, authors should make the data available or state why they cannot. Fabrication and selective reporting are grounds for rejection and retraction.",
                ],
                [
                  "Competing interests",
                  "Financial and non-financial interests that could be seen to influence the work must be declared at submission.",
                ],
              ]}
            />
          </VenueSection>

          <VenueSection
            title="Corrections, retractions, and appeals"
            description="How errors and disputes are handled after publication."
          >
            <PolicyList
              items={[
                [
                  "Corrections",
                  "A published error that affects the record but not the conclusions is corrected with a dated notice linked to the article. The original PDF is preserved.",
                ],
                [
                  "Retractions",
                  "Fabrication, plagiarism, or an unrecoverable methodological error leads to a retraction notice. The retracted article remains online, marked as retracted, so the record is not erased.",
                ],
                [
                  "Appeals",
                  "An author may appeal an editorial decision in writing to the editor-in-chief. Appeals are considered once, on the substance of the reviewers' concerns.",
                ],
              ]}
            />
          </VenueSection>

          <VenueSection
            title="Archiving and preservation"
            description="What happens to an article after it is published."
          >
            <PolicyList
              items={[
                [
                  "Permanent record",
                  "Published articles are not removed. A retracted article stays online and is marked as retracted, so the scholarly record remains complete and citable.",
                ],
                [
                  "Preservation",
                  "The version of record and its metadata are retained on ScholarBase and covered by the publisher's database and file backups. If the platform is ever discontinued, the publisher will arrange continued access to the archive and announce the arrangements on this page.",
                ],
                [
                  "Linking",
                  "Every article has a stable landing page and, where one is assigned, a DOI. Citation metadata is exposed in standard formats so indexes and reference managers can harvest it without scraping the layout.",
                ],
              ]}
            />
          </VenueSection>

          <VenueSection
            title="Submitting a manuscript"
            description="Submissions are handled inside the ScholarBase workspace."
          >
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Sign in, open this venue&apos;s page, and choose{" "}
              {`“${venue.type === "JOURNAL" ? "Submit a manuscript" : "Submit a paper"}”`}.
              You will upload the manuscript as a PDF and add the title,
              abstract, keywords, and co-authors. The editor is notified as soon
              as the submission is recorded, and the status timeline stays
              visible under your workspace submissions. The PDF is the version
              of record.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Authors invited to extend an accepted conference paper also
              receive a submission link by notification. The extended version is
              a new submission at this venue; the conference paper and its
              decision are not changed.
            </p>
            {venue.contactEmail ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                Questions about scope before submitting? Write to{" "}
                <a
                  className="font-medium text-blue-700 underline dark:text-blue-300"
                  href={`mailto:${venue.contactEmail}`}
                >
                  {venue.contactEmail}
                </a>
                .
              </p>
            ) : null}
          </VenueSection>
        </div>

        <aside className="space-y-6">
          <section className="sb-card">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              At a glance
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Publisher</dt>
                <dd className="text-right font-medium">{venue.publisherName}</dd>
              </div>
              {issn ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">ISSN</dt>
                  <dd className="font-medium">{issn}</dd>
                </div>
              ) : null}
              {eissn ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">e-ISSN</dt>
                  <dd className="font-medium">{eissn}</dd>
                </div>
              ) : null}
              {venue.frequency ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Frequency</dt>
                  <dd className="text-right font-medium">{venue.frequency}</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Peer review</dt>
                <dd className="text-right font-medium">2 independent reviewers</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Licence</dt>
                <dd className="text-right font-medium">CC BY 4.0</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Author charges</dt>
                <dd className="text-right font-medium">None</dd>
              </div>
            </dl>
            <Link
              className="mt-4 block border-t border-[var(--card-border)] pt-4 text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
              href={base + "/" + venue.slug}
            >
              Back to {isJournal ? "the journal" : "the conference"}
            </Link>
          </section>
        </aside>
      </div>

      <VenueImprint venue={venue} />
    </main>
  );
}
