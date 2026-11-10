import type { Metadata } from "next";
import {
  DEFAULT_SEO_IMAGE,
  SEO_SITE,
  SITE_NAME,
  SITE_URL,
  formatPageTitle,
} from "@/constants/seo";

/** Resolve a path (or absolute URL) to an absolute URL. */
const absoluteUrl = (value: string): string =>
  /^https?:\/\//i.test(value)
    ? value
    : `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;

/**
 * Normalise whitespace, strip rich-text HTML, and clamp a description to
 * avoid truncated meta tags.
 *
 * The HTML strip is load-bearing: several detail pages pass their rich-text
 * body (`survey.description`, `post.content`, ...) straight into
 * `buildMetadata`. Without it the og:description tag renders literal
 * `<p>`/`<a>` markup in the link-preview card that WhatsApp / Slack unfurl.
 * Pages that already strip manually are unaffected (stripping is idempotent).
 */
const truncate = (text: string, max = 158): string => {
  const clean = (text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
};

export interface BuildMetadataOptions {
  title: string;
  description: string;
  path?: string;
  type?: "website" | "article" | "profile";
  keywords?: string[];
  author?: string;
  publishedTime?: Date | string | null;
  modifiedTime?: Date | string | null;
  section?: string;
  image?: string | null;
}

export function buildMetadata(options: BuildMetadataOptions): Metadata {
  const url = options.path ? absoluteUrl(options.path) : SITE_URL;
  const image = options.image && options.image.trim() ? absoluteUrl(options.image) : absoluteUrl(DEFAULT_SEO_IMAGE);
  const description = truncate(options.description);
  const title = formatPageTitle(options.title);
  const type = options.type ?? "website";
  const publishedTime = options.publishedTime ? new Date(options.publishedTime).toISOString() : undefined;
  const modifiedTime = options.modifiedTime ? new Date(options.modifiedTime).toISOString() : undefined;

  return {
    title,
    description,
    ...(options.keywords && options.keywords.length ? { keywords: options.keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      type,
      locale: "en_US",
      siteName: SEO_SITE.name,
      title,
      description,
      url,
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      ...(options.section ? { section: options.section } : {}),
      ...(options.author ? { authors: [options.author] } : {}),
      images: [{ url: image, width: 1200, height: 630, alt: options.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-video-preview": -1,
        "max-snippet": -1,
      },
    },
  };
}

/**
 * Organisation + WebSite identity, serialised for the root layout.
 *
 * Google builds the logo tile in its "About the source" panel from the favicon
 * and `Organization.logo` — never from `og:image`, which is the 1200x630 card
 * used for link previews. So the square 512x512 `logo.png` is advertised here
 * with explicit dimensions; that is the largest first-party asset it can pick.
 *
 * Deliberately no `sameAs` and no `potentialAction` search box: there are no
 * verified profile URLs or a public search endpoint to point at, and inventing
 * them is worse than omitting them.
 *
 * Returns a string because the caller injects it with `dangerouslySetInnerHTML`.
 * `<` is escaped so a value can never terminate the surrounding `<script>` tag.
 */
export function buildSiteJsonLd(): string {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SEO_SITE.description,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/logo.png`,
          width: 512,
          height: 512,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return JSON.stringify(graph).replace(/</g, "\\u003c");
}

/** Static, so it is serialised once per server process rather than per request. */
export const SITE_JSON_LD = buildSiteJsonLd();

/** Metadata for private / auth-gated / form pages that should never be indexed. */
export function buildNoindexMetadata(title = SITE_NAME): Metadata {
  return {
    title,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export { SITE_NAME, SITE_URL };
