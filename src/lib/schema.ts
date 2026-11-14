/**
 * Per-page structured data.
 *
 * One builder, one shape, so the 18 detail pages cannot drift apart. Each page
 * passes the row it already loaded — no builder performs a query, and nothing
 * here accepts a viewer identity, so this cannot leak private fields.
 *
 * Honesty about types is deliberate. Only a handful of these are eligible for
 * a Google rich result (Article, DiscussionForumPosting, Review, Course,
 * JobPosting, SoftwareApplication). The rest use `CreativeWork` with a `genre`
 * rather than a plausible-looking but non-existent schema.org type — invented
 * types are worse than an accurate generic one, because validators flag them
 * and consumers ignore them.
 */
import { SITE_URL } from "@/constants/seo";
import { stripHtmlTags } from "@/lib/html";

export type JsonLdNode = Record<string, unknown>;

/**
 * Module → schema.org type.
 *
 * Kept in one place so a page picks a type by module name instead of
 * hand-writing a string that can drift from the sitemap and the rest.
 */
export const CONTENT_SCHEMA = {
  article: "BlogPosting",
  socialPost: "DiscussionForumPosting",
  publication: "ScholarlyArticle",
  journal: "Periodical",
  journalReview: "Review",
  researchTool: "SoftwareApplication",
  researchGrant: "Grant",
  course: "Course",
  researchSurvey: "CreativeWork",
  admission: "CreativeWork",
  academicPosition: "JobPosting",
  callForPaper: "CreativeWork",
  result: "CreativeWork",
  helpPost: "DiscussionForumPosting",
  supervisor: "Person",
  recommendation: "Review",
  contribution: "Article",
  user: "Person",
} as const satisfies Record<string, string>;

export type ContentModule = keyof typeof CONTENT_SCHEMA;
export type ContentSchemaType = (typeof CONTENT_SCHEMA)[ContentModule];

/** Nodes that are `Article`-like enough for Google to expect `headline`. */
const HEADLINE_TYPES = new Set<ContentSchemaType>([
  "Article",
  "BlogPosting",
  "ScholarlyArticle",
  "DiscussionForumPosting",
  "Review",
  "CreativeWork",
]);

const toAbsolute = (value: string): string =>
  /^https?:\/\//i.test(value)
    ? value
    : `${SITE_URL}${value.startsWith("/") ? "" : "/"}${value}`;

const toIso = (value?: Date | string | null): string | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/**
 * Plain text, clamped.
 *
 * Rich-text bodies arrive as HTML. Passing them through unstripped would put
 * literal `<p>` tags into a JSON-LD `name`, and clamping keeps a 10k-character
 * post from producing a description fragment nobody reads.
 */
export function plainText(
  value: string | null | undefined,
  max = 300,
): string | undefined {
  if (!value) return undefined;
  const text = stripHtmlTags(value).replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export type ContentJsonLdInput = {
  type: ContentSchemaType;
  /** Site-relative path, e.g. `/feed/abc`. Prefixed with `SITE_URL`. */
  path: string;
  name: string;
  description?: string | null;
  author?: { name?: string | null; path?: string | null } | null;
  datePublished?: Date | string | null;
  /** Pass `editedAt`, not `updatedAt`: counters bump the latter. */
  dateModified?: Date | string | null;
  image?: string | null;
  keywords?: readonly string[] | null;
  /** Type-specific properties, merged verbatim (JobPosting, Course, Review…). */
  extra?: JsonLdNode;
};

/**
 * Builds one node, without `@context`.
 *
 * `@context` is added by the `JsonLd` component, because a page that emits a
 * content node *and* a breadcrumb has to merge both into one `@graph` — and a
 * duplicated `@context` inside a graph is invalid.
 */
export function buildContentJsonLd(input: ContentJsonLdInput): JsonLdNode {
  const url = toAbsolute(input.path);
  const description = plainText(input.description);
  const authorName = input.author?.name?.trim();
  // A scholar/supervisor page describes a person, not a post the site
  // published, so the `isPartOf`/`publisher` back-references that belong on a
  // content node would be false there.
  const isProfile = input.type === "Person";

  return {
    "@type": input.type,
    "@id": `${url}#main`,
    url,
    name: input.name,
    ...(HEADLINE_TYPES.has(input.type) ? { headline: input.name } : {}),
    mainEntityOfPage: { "@id": url },
    ...(isProfile
      ? {}
      : {
          isPartOf: { "@id": `${SITE_URL}/#website` },
          publisher: { "@id": `${SITE_URL}/#organization` },
        }),
    ...(description ? { description } : {}),
    ...(authorName
      ? {
          author: {
            "@type": "Person",
            name: authorName,
            ...(input.author?.path
              ? { url: toAbsolute(input.author.path) }
              : {}),
          },
        }
      : {}),
    ...(toIso(input.datePublished)
      ? { datePublished: toIso(input.datePublished) }
      : {}),
    ...(toIso(input.dateModified)
      ? { dateModified: toIso(input.dateModified) }
      : {}),
    ...(input.image && input.image.trim()
      ? { image: { "@type": "ImageObject", url: toAbsolute(input.image) } }
      : {}),
    ...(input.keywords && input.keywords.length
      ? { keywords: input.keywords.join(", ") }
      : {}),
    ...input.extra,
  };
}

/**
 * Breadcrumb trail for a detail page.
 *
 * Google renders this instead of the raw URL in results, so it is the cheapest
 * visible win available here. Positions must start at 1 and be contiguous.
 */
export function buildBreadcrumbList(
  items: readonly { name: string; path: string }[],
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: toAbsolute(item.path),
    })),
  };
}
