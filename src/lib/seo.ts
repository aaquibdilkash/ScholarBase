import type { Metadata } from "next";

const SITE_NAME = "ScholarBase";
const SITE_URL = "https://scholarbase.app";
const DEFAULT_IMAGE = "/og-image.png";

/** Resolve a path (or absolute URL) to an absolute URL. */
const absoluteUrl = (value: string): string =>
  /^https?:\/\//i.test(value)
    ? value
    : `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;

/** Normalise whitespace and clamp a description to avoid truncated meta tags. */
const truncate = (text: string, max = 158): string => {
  const clean = (text || "").replace(/\s+/g, " ").trim();
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
  const image = options.image && options.image.trim() ? absoluteUrl(options.image) : absoluteUrl(DEFAULT_IMAGE);
  const description = truncate(options.description);
  const type = options.type ?? "website";
  const publishedTime = options.publishedTime ? new Date(options.publishedTime).toISOString() : undefined;
  const modifiedTime = options.modifiedTime ? new Date(options.modifiedTime).toISOString() : undefined;

  return {
    title: options.title,
    description,
    ...(options.keywords && options.keywords.length ? { keywords: options.keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      type,
      locale: "en_US",
      siteName: SITE_NAME,
      title: options.title,
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
      title: options.title,
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

/** Metadata for private / auth-gated / form pages that should never be indexed. */
export function buildNoindexMetadata(title = "ScholarBase"): Metadata {
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
