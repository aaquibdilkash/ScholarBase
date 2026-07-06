import { createClient } from "@/utils/supabase/server";
import { submitSupportRequest } from "@/app/actions/support";

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; message?: string }>;
}) {
  const { submitted, message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <div className="mb-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
          Help / Report a Bug
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Tell us what should improve
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Send bugs, feature ideas, or usability problems. We’ll keep it
          lightweight and use it to improve ScholarBase.
        </p>
        {submitted && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Your request has been sent.
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            {message}
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <form
          action={submitSupportRequest}
          className="sb-surface-strong space-y-6 p-8 md:p-10"
        >
          <div>
            <label className="sb-label">Email</label>
            <input
              name="email"
              defaultValue={user?.email ?? ""}
              className="sb-input"
              placeholder="you@example.com"
              required={!user}
            />
          </div>

          <div>
            <label className="sb-label">Category</label>
            <select
              name="category"
              className="sb-input"
              defaultValue="bug"
              required
            >
              <option value="bug">Bug report</option>
              <option value="feature">Feature request</option>
              <option value="improvement">Site improvement</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="sb-label">Subject</label>
            <input
              name="subject"
              className="sb-input"
              placeholder="Short summary of your message"
              required
            />
          </div>

          <div>
            <label className="sb-label">Details</label>
            <textarea
              name="message"
              className="sb-input min-h-56 resize-y"
              placeholder="Describe the issue, idea, or improvement in detail..."
              required
            />
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button type="submit" className="sb-button-accent">
              Send to developer
            </button>
          </div>
        </form>

        <aside className="sb-card h-fit space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">What to send</h2>
          <ul className="space-y-3 text-sm leading-relaxed text-slate-600">
            <li>• Bugs that break pages, forms, or mobile layout.</li>
            <li>• Feature ideas you want added to ScholarBase.</li>
            <li>• Improvements that would make the site faster or clearer.</li>
            <li>
              • Missing notifications, editor issues, or profile problems.
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
