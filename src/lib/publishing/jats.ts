import type { ArticleSummary, PublicVenue } from "@/lib/publishing/public";

/** Escape text and attribute values without trusting article-authored content. */
function xml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function element(name: string, value: string | null | undefined, attrs = ""): string {
  const clean = text(value);
  return clean ? `<${name}${attrs}>${xml(clean)}</${name}>` : "";
}

function authorName(name: string): { given: string; surname: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { given: "", surname: parts[0] ?? "" };
  return { given: parts.slice(0, -1).join(" "), surname: parts.at(-1) ?? "" };
}

function jatsDate(value: Date | null): string {
  if (!value) return "";
  const iso = value.toISOString();
  return `<date><day>${xml(iso.slice(8, 10))}</day><month>${xml(iso.slice(5, 7))}</month><year>${xml(iso.slice(0, 4))}</year></date>`;
}

/**
 * Generates standards-shaped JATS from the canonical publication record.
 *
 * This deliberately generates metadata JATS, not invented full text. The PDF
 * remains the version of record until structured body content is supplied by
 * an author/editor. The output is deterministic, small, and cheap enough to
 * generate on demand on the two-CPU deployment.
 */
export function buildJatsXml(
  article: ArticleSummary,
  venue: PublicVenue,
  articleUrl: string,
): string {
  const articleType = venue.type === "JOURNAL" ? "research-article" : "conference-paper";
  const contributors = article.authors.map((author, index) => {
    const name = authorName(author.name);
    const affiliation = text(author.affiliation);
    const roles = author.creditRoles?.length
      ? `<role>${author.creditRoles.map((role) => xml(role)).join(", ")}</role>`
      : "";
    const affiliationXml = affiliation
      ? `<aff><institution-wrap><institution>${xml(affiliation)}</institution>${author.rorId ? `<institution-id institution-id-type="ROR">${xml(author.rorId)}</institution-id>` : ""}</institution-wrap></aff>`
      : "";
    return `<contrib contrib-type="author"${index === 0 ? ' corresp="yes"' : ""}><name>${element("surname", name.surname)}${element("given-names", name.given)}</name>${author.orcid ? `<contrib-id contrib-id-type="orcid">${xml(author.orcid)}</contrib-id>` : ""}${roles}${affiliationXml}</contrib>`;
  }).join("");

  const keywords = [
    ...(article.keywords?.split(",").map(text).filter(Boolean) ?? []),
    ...(article.jelCodes?.split(",").map((code) => `JEL: ${code.trim()}`).filter((code) => code !== "JEL: ") ?? []),
  ];
  const keywordXml = keywords.length
    ? `<kwd-group kwd-group-type="author-keywords">${keywords.map((keyword) => `<kwd>${xml(keyword)}</kwd>`).join("")}</kwd-group>`
    : "";
  const declarations = [
    ["funding", article.fundingStatement],
    ["data-availability", article.dataAvailabilityStatement],
    ["ethics", article.ethicsStatement],
    ["competing-interests", article.competingInterests],
    ["ai-use", article.aiUseStatement],
  ].filter(([, value]) => text(value));
  const declarationXml = declarations.length
    ? `<custom-meta-group>${declarations.map(([name, value]) => `<custom-meta><meta-name>${xml(name)}</meta-name><meta-value>${xml(value)}</meta-value></custom-meta>`).join("")}</custom-meta-group>`
    : "";
  const issn = venue.eissn ?? venue.issn;
  const doi = article.doi ? `<article-id pub-id-type="doi">${xml(article.doi)}</article-id>` : "";
  const pdf = `<self-uri content-type="pdf" xlink:href="${xml(new URL(`/api/papers/${article.id}/file`, articleUrl).toString())}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<article xmlns:xlink="http://www.w3.org/1999/xlink" article-type="${articleType}" dtd-version="1.4">
  <front>
    <journal-meta>${element("journal-id", venue.slug, " journal-id-type=\"publisher-id\"")}${element("journal-title", venue.name)}${issn ? `<issn pub-type="electronic">${xml(issn)}</issn>` : ""}<publisher><publisher-name>${xml(venue.publisherName)}</publisher-name></publisher></journal-meta>
    <article-meta>${element("article-id", article.id, " pub-id-type=\"publisher-id\"")}${doi}${element("article-title", article.title)}<contrib-group>${contributors}</contrib-group>${jatsDate(article.publishedAt)}${element("abstract", article.abstract)}${keywordXml}${declarationXml}${pdf}<permissions><license><ali:license_ref xmlns:ali="http://www.niso.org/schemas/ali/1.0/">${xml(venue.licenseUrl)}</ali:license_ref></license></permissions></article-meta>
  </front>
</article>
`;
}
