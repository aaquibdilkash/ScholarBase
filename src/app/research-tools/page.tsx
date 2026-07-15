import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getResearchTools } from "../actions/researchTools";
import { ResearchToolsList } from "./components/ResearchToolsList";

export default async function ResearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tools = await getResearchTools(user?.id);

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Research Tools
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Discover and share tools that can help with your research.
          </p>
        </div>
        <Link
          href="/research-tools/new"
          className="sb-button-accent whitespace-nowrap"
        >
          + Add Research Tool
        </Link>
      </div>
      <ResearchToolsList tools={tools} />
    </main>
  );
}
