import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import NetnoKitStudio from "@/components/netnokit/NetnoKitStudio";

export const metadata: Metadata = buildMetadata({
  title: "NetnoKit — Netnography Comment Exporter | ScholarBase",
  description:
    "Export YouTube and Instagram comments as CSV or Excel for netnographic research. IRB-friendly anonymization, threaded comments, and a reproducibility metadata sheet.",
  path: "/research-tools/netnography-exporter",
  section: "Research Tools",
});

export default function NetnoKitPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <NetnoKitStudio />
    </main>
  );
}
