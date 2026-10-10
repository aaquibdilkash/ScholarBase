import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";
import { EDIT_PAGE_TEXT } from "@/constants/seo";

// Editing a post is a private, auth-gated action — never index it. The edit
// page itself is a client component ("use client") and cannot export metadata,
// so it lives here in a server layout instead.
export const metadata: Metadata = buildNoindexMetadata(
  `${EDIT_PAGE_TEXT.feed.title} - ScholarBase`,
);

export default function EditPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
