import type { Metadata } from "next";

const SITE_NAME = "ScholarBase";
const SITE_URL = "https://scholarbase.app";

export function buildMetadata(options: {
  title: string;
  description: string;
  path?: string;
  type?: "website" | "article" | "profile";
}): Metadata {
  const url = options.path ? `${SITE_URL}${options.path}` : SITE_URL;
  const imageUrl = "/og-image.png";

  return {
    title: options.title,
    description: options.description,
    alternates: { canonical: url },
    openGraph: {
      type: options.type ?? "website",
      siteName: SITE_NAME,
      title: options.title,
      description: options.description,
      url,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: options.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: [imageUrl],
    },
  };
}
