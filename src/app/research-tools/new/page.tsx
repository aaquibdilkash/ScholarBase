import { createResearchTool } from "@/app/actions/researchTools";
import Link from "next/link";

export default function NewResearchToolPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/research-tools"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Research Tools
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Add a new Research Tool
        </h1>
        <p className="mt-2 text-slate-600">
          Contribute to the community by adding a new research tool to the
          database.
        </p>
      </div>
      <form
        action={createResearchTool}
        className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
      >
        <div>
          <label className="sb-label">Tool Name</label>
          <input
            name="name"
            placeholder="e.g., Zotero"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Website</label>
          <input
            name="website"
            placeholder="e.g., https://www.zotero.org/"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Primary Use</label>
          <input
            name="use"
            placeholder="e.g., Reference Management"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Description</label>
          <textarea
            name="description"
            placeholder="Briefly describe the tool and its features..."
            className="sb-input h-32"
            required
          />
        </div>

        <button type="submit" className="sb-button-accent mt-2 self-end">
          Add Research Tool
        </button>
      </form>
    </main>
  );
}
