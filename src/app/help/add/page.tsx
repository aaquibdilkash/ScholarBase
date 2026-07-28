import type { Metadata } from "next";
import Link from "next/link";
import HelpPostForm from "@/components/help/HelpPostForm";

export const metadata: Metadata = {
  title: "Post Help / Feedback",
  description: "Report bugs, request features, or provide feedback to improve ScholarBase.",
  robots: { index: false, follow: true },
};

export default function NewHelpPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/help"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Help
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Post Help / Feedback
        </h1>
        <p className="mt-2 text-slate-600">
          Report bugs, request features, or provide feedback to improve ScholarBase.
        </p>
      </div>

      <HelpPostForm mode="create" />
    </main>
  );
}