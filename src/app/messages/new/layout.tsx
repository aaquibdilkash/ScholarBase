import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";
import React from "react";

export const metadata: Metadata = buildNoindexMetadata("New Message - ScholarBase");

export default function NewMessageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
