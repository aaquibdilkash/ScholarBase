import type { Metadata } from "next";
import { inviteScholar } from "@/app/actions/scholars";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Invite Scholar",
  description:
    "Invite a scholar to join ScholarBase and collaborate on research.",
  robots: { index: false, follow: true },
};

export default async function InviteScholarPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <CreateOrEditPageShell
      title="Invite Scholar"
      description="Send a collaboration invite to a scholar who is not on ScholarBase yet."
      backHref="/scholars"
      backLabel="← Back to Scholars"
      maxWidth="sm"
    >
      {message ? (
        <p className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {message}
        </p>
      ) : null}

      <form action={inviteScholar} className="space-y-5 sb-card p-6 md:p-8">
        <div>
          <label className="sb-label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            className="sb-input"
            placeholder="Scholar name"
          />
        </div>
        <div>
          <label className="sb-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="sb-input"
            placeholder="scholar@university.edu"
            required
          />
        </div>
        <div>
          <label className="sb-label" htmlFor="message">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            className="sb-textarea min-h-40"
            placeholder="Tell them why they should join ScholarBase."
            required
          />
        </div>
        <button type="submit" className="sb-button-primary">
          Send invite
        </button>
      </form>
    </CreateOrEditPageShell>
  );
}
