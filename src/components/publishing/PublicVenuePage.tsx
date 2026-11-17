import Link from "next/link";
import { notFound } from "next/navigation";

import { RichContent } from "@/components/content/RichContent";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  ArticleList,
  articleHref,
  issueLocator,
} from "@/components/publishing/ArticleList";
import {
  VenueImprint,
  VenueMasthead,
  VenueSection,
  displayIssn,
  venueBasePath,
} from "@/components/publishing/VenueMasthead";
import { plainText } from "@/lib/schema";
import { SITE_URL } from "@/constants/seo";
import { formatDate } from "@/utils/date";
import {
  getPublishedArticles,
  getVenuePage,
  groupIntoIssues,
  issueStats,
  type IssueGroup,
  type PublicVenue,
  type VenueType,
} from "@/lib/publishing/public";

/**
 * Public home page for a journal or a conference.
 *
 * The layout mirrors what an ISSN reviewer checks, in the order they check it:
 * identity above the fold, then aims & scope, then a real table of contents,
 * then the board with affiliations, then the publisher imprint.
 */

function groupBoard(venue: PublicVenue) {
  const groups = new Map<string, PublicVenue["board"]>();

  for (const member of venue.board) {
    const list = groups.get(member.roleTitle) ?? [];
    list.push(member);
    groups.set(member.roleTitle, list);
  }

  return [...groups.entries()];
}

function BoardList({ venue }: { venue: PublicVenue }) {
  const groups = groupBoard(venue);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The editorial board is being constituted.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {groups.map(([role, members]) => (
        <div key={role}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {role}
          </h3>
          <ul className="mt-2 space-y-3">
            {members.map((member) => (
              <li key={`${member.name}-${member.roleTitle}`}>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {member.name}
                </p>
                {member.affiliation ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {member.affiliation}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Facts({ venue, issues }: { venue: PublicVenue; issues: IssueGroup[] }) {
  const stats = issueStats(issues);
  const issn = displayIssn(venue.issn);
  const eissn = displayIssn(venue.eissn);

  const facts: Array<[string, string | null]> = [
    ["Publisher", venue.publisherName],
    ["ISSN", issn],
    ["e-ISSN", eissn],
    ["Frequency", venue.frequency],
    ["Editor-in-chief", venue.editorName],
    ["Launched", venue.launchedAt ? formatDate(venue.launchedAt) : null],
    ["Articles", String(stats.articleCount)],
    ["Volumes", stats.volumeCount ? String(stats.volumeCount) : null],
  ];

  return (
    <dl className="space-y-3 text-sm">
      {facts
        .filter(([, value]) => Boolean(value))
        .map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
              {value}
            </dd>
          </div>
        ))}
    </dl>
  );
}

function IssueBlock({
  venue,
  group,
  title,
}: {
  venue: PublicVenue;
  group: IssueGroup;
  title: string;
}) {
  const locator = issueLocator(group.volume, group.issue);
  const latest = group.latest;

  return (
    <section className="sb-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          {title}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {[locator, latest ? formatDate(latest) : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="mt-4">
        <ArticleList venue={venue} articles={group.articles} />
      </div>
    </section>
  );
}

function JournalBody({
  venue,
  issues,
}: {
  venue: PublicVenue;
  issues: IssueGroup[];
}) {
  const currentIssue = issues.find((group) => group.volume !== null) ?? null;
  const onlineFirst = issues.find((group) => group.volume === null) ?? null;

  return (
    <div className="space-y-6">
      {onlineFirst ? (
        <IssueBlock venue={venue} group={onlineFirst} title="Online first" />
      ) : null}

      {currentIssue ? (
        <IssueBlock
          venue={venue}
          group={currentIssue}
          title={`Current issue — ${issueLocator(currentIssue.volume, currentIssue.issue) ?? "Volume"}`}
        />
      ) : null}

      {issues.length === 0 ? (
        <VenueSection
          title="Current issue"
          description="The first issue is in preparation."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Accepted manuscripts appear here once the editor publishes an issue.
            Until then, the aims, scope, and editorial board above describe the
            journal in full.
          </p>
        </VenueSection>
      ) : null}

      <VenueSection
        title="Publication and archiving"
        description="How the version of record is produced and kept."
      >
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>
            Every accepted article is published as a fixed PDF — the version of
            record — alongside the metadata on this page. PDFs are not silently
            replaced; a correction is a new, separately dated version.
          </li>
          <li>
            Articles are open access and carried on ScholarBase, which is also the
            publisher of record. No subscription or paywall stands between a
            reader and the PDF.
          </li>
          <li>
            Each article page exposes citation metadata (Highwire tags and
            JSON-LD) so reference managers and scholarly indexes can harvest it
            without scraping the layout.
          </li>
        </ul>
      </VenueSection>
    </div>
  );
}

function ConferenceBody({
  venue,
  issues,
}: {
  venue: PublicVenue;
  issues: IssueGroup[];
}) {
  const volumes = issues.filter((group) => group.volume !== null);
  const online = issues.find((group) => group.volume === null) ?? null;
  const isbn = volumes.find((group) => group.articles.some((article) => article.isbn))
    ?.articles.find((article) => article.isbn)?.isbn;

  return (
    <div className="space-y-6">
      {online ? (
        <IssueBlock venue={venue} group={online} title="Published papers" />
      ) : null}

      {volumes.length > 0 ? (
        <section className="sb-card" id="proceedings">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Proceedings
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isbn
              ? `Collected volume, ISBN ${isbn}.`
              : "Collected volume — ISBN assigned on publication."}
          </p>
          <ul className="mt-4 space-y-3">
            {volumes.map((group) => (
              <li key={`${group.volume}-${group.issue ?? ""}`}>
                <Link
                  className="text-sm font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                  href={`${venueBasePath(venue.type)}/${venue.slug}/proceedings/${group.volume}`}
                >
                  {issueLocator(group.volume, group.issue) ?? "Volume"} —{" "}
                  {group.articles.length} paper
                  {group.articles.length === 1 ? "" : "s"}
                </Link>
                {group.latest ? (
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(group.latest)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <VenueSection
          title="Proceedings"
          description="The collected volume is published after the conference."
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Accepted papers appear here, and the collected volume is issued with
            an ISBN once the programme closes.
          </p>
        </VenueSection>
      )}

      <VenueSection
        title="Proceedings and archiving"
        description="How papers in this conference are published."
      >
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>
            Each accepted paper is published as a fixed PDF — the version of
            record — with its page range in the collected volume.
          </li>
          <li>
            The volume carries an ISBN on its copyright page; individual papers
            inherit it for citation purposes and carry their own DOI when one is
            assigned.
          </li>
          <li>
            Papers remain openly readable on ScholarBase after the conference
            closes. Nothing is removed when the event ends.
          </li>
        </ul>
      </VenueSection>
    </div>
  );
}

export async function PublicVenuePage({
  slug,
  type,
}: {
  slug: string;
  type: VenueType;
}) {
  const result = await getVenuePage(slug, type);
  if (!result) notFound();

  const { venue, preview } = result;
  const articles = await getPublishedArticles(venue.id);
  const issues = groupIntoIssues(articles);
  const isJournal = venue.type === "JOURNAL";
  const base = venueBasePath(venue.type);

  const structuredData = isJournal
    ? {
        "@type": "Periodical",
        "@id": `${SITE_URL}${base}/${venue.slug}#periodical`,
        name: venue.name,
        url: `${SITE_URL}${base}/${venue.slug}`,
        ...(displayIssn(venue.issn) ? { issn: displayIssn(venue.issn) } : {}),
        // `Periodical` has one `issn`; the electronic ISSN is the same
        // identifier in a different medium, so it goes in `identifier` rather
        // than overwriting the print one.
        ...(displayIssn(venue.eissn)
          ? {
              identifier: {
                "@type": "PropertyValue",
                propertyID: "eISSN",
                value: displayIssn(venue.eissn),
              },
            }
          : {}),
        publisher: { "@type": "Organization", name: venue.publisherName },
        ...(venue.editorName
          ? { editor: { "@type": "Person", name: venue.editorName } }
          : {}),
        ...(venue.aimsAndScope
          ? { description: plainText(venue.aimsAndScope, 400) }
          : {}),
        inLanguage: "en",
      }
    : {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}${base}/${venue.slug}#collection`,
        name: venue.name,
        url: `${SITE_URL}${base}/${venue.slug}`,
        about: { "@type": "Event", name: venue.name },
        publisher: { "@type": "Organization", name: venue.publisherName },
        ...(venue.aimsAndScope
          ? { description: plainText(venue.aimsAndScope, 400) }
          : {}),
        inLanguage: "en",
      };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={structuredData} />
      <VenueMasthead venue={venue} preview={preview} activeTab="overview" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-6">
          {venue.aimsAndScope ? (
            <VenueSection
              title={isJournal ? "Aims and scope" : "About the conference"}
            >
              <RichContent content={venue.aimsAndScope} />
            </VenueSection>
          ) : null}

          {isJournal ? (
            <JournalBody venue={venue} issues={issues} />
          ) : (
            <ConferenceBody venue={venue} issues={issues} />
          )}

          <VenueSection
            title={isJournal ? "Editorial board" : "Committee"}
            description="Names and affiliations of the scholars responsible for peer review and decisions."
          >
            <BoardList venue={venue} />
          </VenueSection>
        </div>

        <aside className="space-y-6">
          <section className="sb-card">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              {isJournal ? "Journal information" : "Conference information"}
            </h2>
            <div className="mt-4">
              <Facts venue={venue} issues={issues} />
            </div>
            <div className="mt-4 space-y-2 border-t border-[var(--card-border)] pt-4 text-sm">
              <Link
                className="block font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                href={`${base}/${venue.slug}/guidelines`}
              >
                Author guidelines and policies
              </Link>
              <Link
                className="block font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                href={`${base}/${venue.slug}/archive`}
              >
                {isJournal ? "Browse the archive" : "Browse published papers"}
              </Link>
            </div>
            {venue.isPublished && !venue.isDemo ? (
              <Link
                className="sb-button-primary mt-4 flex w-full items-center justify-center"
                href={`/workspace/submissions/new?venue=${venue.slug}`}
              >
                {isJournal ? "Submit a manuscript" : "Submit a paper"}
              </Link>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-[var(--card-border)] px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                This venue is not accepting submissions yet.
              </p>
            )}
          </section>

          {venue.editorName ? (
            <section className="sb-card">
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                Editor-in-chief
              </h2>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                {venue.editorName}
              </p>
              {venue.editorAffiliation ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {venue.editorAffiliation}
                </p>
              ) : null}
              {venue.editorOrcid ? (
                <a
                  className="mt-2 inline-block text-xs text-blue-700 underline dark:text-blue-300"
                  href={`https://orcid.org/${venue.editorOrcid}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  ORCID {venue.editorOrcid}
                </a>
              ) : null}
            </section>
          ) : null}

          {venue.contactEmail ? (
            <section className="sb-card">
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                Contact
              </h2>
              <a
                className="mt-3 block break-words text-sm text-blue-700 underline dark:text-blue-300"
                href={`mailto:${venue.contactEmail}`}
              >
                {venue.contactEmail}
              </a>
            </section>
          ) : null}
        </aside>
      </div>

      {articles.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Latest articles
          </h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {articles.slice(0, 6).map((article) => (
              <li key={article.id} className="min-w-0">
                <Link
                  className="text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                  href={articleHref(venue, article.id)}
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <VenueImprint venue={venue} />
    </main>
  );
}
