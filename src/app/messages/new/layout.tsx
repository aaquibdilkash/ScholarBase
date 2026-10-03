import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import React from "react";
import { SEO_PAGES } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.newMessage.title,
  description: SEO_PAGES.newMessage.description,
  path: SEO_PAGES.newMessage.path,
});

export default function NewMessageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
