/**
 * Citation metadata for published manuscripts.
 *
 * Pure functions only — no database, no React. The article page, the RIS/BibTeX
 * download routes, and the Highwire `<meta>` tags all render from these, so a
 * downloaded citation and the page it came from cannot disagree.
 *
 * The shapes here mirror what a deposit/rendering consumer needs, not the Prisma
 * models: `coAuthors` is stored as JSON and may be absent, malformed, or a
 * wrapper object, so it is normalised once at this boundary.
 */

export type CitationAuthor = {
  name: string;
  affiliation?: string | null;
  orcid?: string | null;
};

export type CitationArticle = {
  id: string;
  title: string;
  keywords?: string | null;
  doi?: string | null;
  volume?: number | null;
  issue?: number | null;
  firstPage?: string | null;
  lastPage?: string | null;
  publishedAt?: Date | string | null;
  isbn?: string | null;
  authors: readonly CitationAuthor[];
};

export type CitationVenue = {
  slug: string;
  name: string;
  type: "JOURNAL" | "CONFERENCE";
  issn?: string | null;
  eissn?: string | null;
  publisherName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Normalises `Manuscript.coAuthors`, which is stored as JSON.
 *
 * Accepts the `{ correspondingAuthor, coAuthors }` wrapper written by the
 * submission form as well as a bare array. Anything that is not a named person
 * is dropped rather than rendered as `[object Object]` on the most visible line
 * of an article.
 */
export function parseCoAuthors(value: unknown): CitationAuthor[] {
  const raw = isRecord(value) ? value.coAuthors : value;
  if (!Array.isArray(raw)) return [];

  const authors: CitationAuthor[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const name = cleanString(entry.name);
    if (!name) continue;
    authors.push({
      name,
      affiliation: cleanString(entry.affiliation),
      orcid: cleanString(entry.orcid),
    });
  }
  return authors;
}

/** `0000-0002-1825-0097` or `https://orcid.org/0000-0002-1825-0097` -> the iD. */
export function orcidIdFromUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/([0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X])/i);
  return match ? match[1].toUpperCase() : trimmed;
}

/** Accepts an iD or a full ORCID URL and returns a profile link. */
export function orcidProfileUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://orcid.org/${trimmed}`;
}

/**
 * The corresponding author's byline stored with the manuscript.
 *
 * `Manuscript.coAuthors` is the wrapper `{ correspondingAuthor, coAuthors }` for
 * rows submitted by the current form. Older rows are a bare co-author array and
 * have no stored byline, so callers fall back to the account.
 */
export function parseCorrespondingAuthor(
  value: unknown,
): (CitationAuthor & { email?: string | null }) | null {
  if (!isRecord(value) || !isRecord(value.correspondingAuthor)) return null;

  const entry = value.correspondingAuthor;
  const name = cleanString(entry.name);
  if (!name) return null;

  return {
    name,
    affiliation: cleanString(entry.affiliation),
    orcid: cleanString(entry.orcid),
    email: cleanString(entry.email),
  };
}

/** The submitting author first, then any co-authors, de-duplicated by name. */
export function buildAuthorList(
  primary: { name: string | null; orcidUrl?: string | null },
  coAuthors: unknown,
): CitationAuthor[] {
  const authors: CitationAuthor[] = [];
  const seen = new Set<string>();

  const add = (author: CitationAuthor) => {
    const key = author.name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    authors.push(author);
  };

  // A manuscript written by the current form carries its own corresponding
  // author byline, which wins over the account: the author may publish under a
  // different name or a different institution than their profile.
  const stored = parseCorrespondingAuthor(coAuthors);
  if (stored) {
    add({
      name: stored.name,
      ...(stored.affiliation ? { affiliation: stored.affiliation } : {}),
      ...(stored.orcid ? { orcid: stored.orcid } : {}),
    });
  } else if (primary.name?.trim()) {
    add({ name: primary.name.trim(), orcid: primary.orcidUrl ?? null });
  }
  for (const author of parseCoAuthors(coAuthors)) add(author);

  return authors;
}

/** `"1"` + `"10"` -> `"1–10"`; one value -> `"1"`; neither -> `null`. */
export function formatPageRange(
  firstPage?: string | null,
  lastPage?: string | null,
): string | null {
  const first = firstPage?.trim();
  const last = lastPage?.trim();
  if (!first) return null;
  if (!last || last === first) return first;
  return `${first}–${last}`;
}

export function citationYear(article: CitationArticle): string | null {
  if (!article.publishedAt) return null;
  const date = new Date(article.publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getUTCFullYear());
}

/** Highwire's `citation_publication_date` format is `YYYY/MM/DD`. */
export function highwireDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}/${month}/${day}`;
}

/** `"Jane Doe"` -> `"Doe, Jane"`; RIS wants surname-first. */
export function invertAuthorName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim();
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(" ");
  return `${surname}, ${given}`;
}

/**
 * Human-readable reference, used for the "Cite this article" block.
 * Deliberately conservative: no invented publisher place or edition.
 */
export function buildPlainCitation(
  article: CitationArticle,
  venue: CitationVenue,
): string {
  const authors = article.authors.map((author) => author.name).join(", ");
  const year = citationYear(article) ?? "n.d.";
  const pages = formatPageRange(article.firstPage, article.lastPage);
  const locator = [
    article.volume ? `vol. ${article.volume}` : null,
    article.issue ? `no. ${article.issue}` : null,
    pages ? `pp. ${pages}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    authors ? `${authors}` : null,
    `(${year}).`,
    `${article.title}.`,
    `${venue.name}`,
    locator ? `${locator}.` : null,
    article.doi ? `https://doi.org/${article.doi}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * RIS record for EndNote/Zotero/Mendeley.
 *
 * `TY  - JOUR` for a journal, `CPAPER` for conference proceedings — both are
 * valid RIS tags and importing software maps them to different item types.
 */
export function buildRisRecord(
  article: CitationArticle,
  venue: CitationVenue,
  articleUrl: string,
): string {
  const isConference = venue.type === "CONFERENCE";
  const pages = formatPageRange(article.firstPage, article.lastPage);

  const lines: string[] = [
    `TY  - ${isConference ? "CPAPER" : "JOUR"}`,
    ...article.authors.map((author) => `AU  - ${invertAuthorName(author.name)}`),
    `TI  - ${article.title}`,
    isConference ? `T2  - ${venue.name}` : `JO  - ${venue.name}`,
    `PY  - ${citationYear(article) ?? ""}`,
    article.volume ? `VL  - ${article.volume}` : null,
    article.issue ? `IS  - ${article.issue}` : null,
    pages ? `SP  - ${article.firstPage ?? ""}` : null,
    pages && article.lastPage ? `EP  - ${article.lastPage}` : null,
    venue.publisherName ? `PB  - ${venue.publisherName}` : null,
    article.doi ? `DO  - ${article.doi}` : null,
    venue.issn ? `SN  - ${venue.issn}` : venue.eissn ? `SN  - ${venue.eissn}` : null,
    article.isbn ? `SN  - ${article.isbn}` : null,
    `UR  - ${articleUrl}`,
    "ER  - ",
  ].filter((line): line is string => Boolean(line));

  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Escapes the characters BibTeX treats as syntax.
 *
 * A backslash is stripped rather than doubled: `\\` is a LaTeX line break, so
 * "escaping" it would inject a newline into a title. Titles do not contain
 * meaningful backslashes, and dropping one is always safer than emitting a
 * command the author never wrote.
 */
function bibtexEscape(value: string): string {
  return value.replace(/\\/g, "").replace(/([&%$#_{}])/g, "\\$1");
}

/** `Müller`/`O'Brien` survive by stripping anything outside a safe key set. */
function bibtexKey(article: CitationArticle, venue: CitationVenue): string {
  const surname = article.authors[0]?.name.trim().split(/\s+/).pop() ?? "anon";
  const year = citationYear(article) ?? "nd";
  return `${venue.slug}${year}${surname}`
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
}

/** BibTeX entry for LaTeX users. `@inproceedings` for a proceedings paper. */export function buildBibtexRecord(
  article: CitationArticle,
  venue: CitationVenue,
): string {
  const isConference = venue.type === "CONFERENCE";
  const pages = formatPageRange(article.firstPage, article.lastPage);
  const fields: Array<[string, string]> = [
    ["title", bibtexEscape(article.title)],
    [
      "author",
      article.authors.map((author) => bibtexEscape(invertAuthorName(author.name))).join(" and "),
    ],
    [isConference ? "booktitle" : "journal", bibtexEscape(venue.name)],
    ["year", citationYear(article) ?? ""],
    ["volume", article.volume ? String(article.volume) : ""],
    ["number", article.issue ? String(article.issue) : ""],
    [
      "pages",
      pages
        ? article.lastPage
          ? `${article.firstPage ?? ""}--${article.lastPage}`
          : (article.firstPage ?? "")
        : "",
    ],
    ["publisher", bibtexEscape(venue.publisherName)],
    ["doi", article.doi ?? ""],
    ["issn", venue.eissn ?? venue.issn ?? ""],
    ["isbn", article.isbn ?? ""],
  ];

  const body = fields
    .filter(([, value]) => value && value.trim())
    .map(([name, value]) => `  ${name} = {${value}}`)
    .join(",\n");

  return `@${isConference ? "inproceedings" : "article"}{${bibtexKey(article, venue)},\n${body}\n}\n`;
}

/**
 * Highwire Press tags, which Google Scholar reads in preference to JSON-LD.
 *
 * `citation_pdf_url` is the tag that matters most: without it Scholar indexes
 * the landing page but offers no full-text link, so the article is invisible to
 * the index most authors actually search. The PDF URL must be absolute and must
 * resolve without a login.
 *
 * Returned as `Metadata.other`, which serialises arrays as repeated meta tags —
 * exactly what `citation_author` needs.
 */
export function buildHighwireMeta(
  article: CitationArticle,
  venue: CitationVenue,
  urls: { articleUrl: string; pdfUrl: string | null },
): Record<string, string | string[]> {
  const meta: Record<string, string | string[]> = {
    citation_title: article.title,
    citation_author: article.authors.map((author) => author.name),
    citation_publication_date: highwireDate(article.publishedAt) ?? "",
    citation_publisher: venue.publisherName,
    citation_abstract_html_url: urls.articleUrl,
  };

  if (venue.type === "CONFERENCE") {
    meta.citation_conference_title = venue.name;
  } else {
    meta.citation_journal_title = venue.name;
  }

  const issn = venue.eissn ?? venue.issn;
  if (issn) meta.citation_issn = issn;
  if (article.isbn) meta.citation_isbn = article.isbn;
  if (article.volume !== null && article.volume !== undefined) {
    meta.citation_volume = String(article.volume);
  }
  if (article.issue !== null && article.issue !== undefined) {
    meta.citation_issue = String(article.issue);
  }
  if (article.firstPage) meta.citation_firstpage = article.firstPage;
  if (article.lastPage) meta.citation_lastpage = article.lastPage;
  if (article.doi) meta.citation_doi = article.doi;
  if (urls.pdfUrl) meta.citation_pdf_url = urls.pdfUrl;

  const keywords = article.keywords
    ?.split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  if (keywords?.length) meta.citation_keywords = keywords;

  // An empty value would render `<meta content="">`, which Scholar treats as a
  // present-but-broken field. Drop it instead.
  for (const [key, value] of Object.entries(meta)) {
    if (value === "") delete meta[key];
  }

  return meta;
}
