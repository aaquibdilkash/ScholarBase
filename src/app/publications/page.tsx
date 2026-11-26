import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.publications.title,
  description: SEO_PAGES.publications.description,
  path: SEO_PAGES.publications.path,
  section: SEO_PAGES.publications.section,
});

export default function PublicationsPage() {
  return null;
}
