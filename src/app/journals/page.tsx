
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getJournals } from "../actions/journals";
import { JournalsList } from "./components/JournalsList";

export default async function JournalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const journals = await getJournals(user?.id);

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Journals
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Browse and discover academic journals.
          </p>
        </div>
        <Link href="/journals/new" className="sb-button-accent whitespace-nowrap">
          + Add Journal
        </Link>
      </div>
      <JournalsList journals={journals} />
    </main>
  );
}

