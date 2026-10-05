import { Suspense } from "react";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES } from "@/constants/seo";
import ShieldStudio from "@/components/shield/ShieldStudio";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.shield.title,
  description: SEO_PAGES.shield.description,
  path: SEO_PAGES.shield.path,
  section: SEO_PAGES.shield.section,
});

export default async function ShieldPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tab === "rewriter" ? "rewriter" : "detector";

  return (
    <main className="mx-auto w-full max-w-7xl py-6 sm:py-8">
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading Scholar Shield...</div>}>
        <ShieldStudio initialTab={initialTab} />
      </Suspense>
    </main>
  );
}
