"use client";

import { useActionState, useState } from "react";

import {
  publishManuscriptAction,
  type ManuscriptActionResult,
} from "@/app/actions/manuscripts";
import { ActionResultMessage } from "@/components/workspace/ActionResultMessage";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

/**
 * Publication form for accepted manuscripts.
 *
 * A paper becomes public the moment this succeeds, so the form asks for the
 * citation locator up front instead of publishing first and editing later — a
 * published row with no volume is exactly the "empty archive" ISSN reviewers
 * reject. One `<details>` per paper keeps a long queue readable.
 */

export type PublishCandidate = {
  id: string;
  title: string;
  authorName: string | null;
  venueName: string;
  venueType: "JOURNAL" | "CONFERENCE";
  status: string;
  editionId: string | null;
  editionLabel: string | null;
  editionVolume: number | null;
  availableIssues: readonly { id: string; volume: number; number: number; title: string | null }[];
};

const EMPTY_RESULT: ManuscriptActionResult = { success: false, message: "" };
const MAX_PAGE_LENGTH = 12;

function Field({
  label,
  tooltip,
  hint,
  children,
}: {
  label: string;
  tooltip: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
        <InfoTooltip message={tooltip} />
      </span>
      <span className="mt-1 block">{children}</span>
      {hint ? (
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

function PublishForm({ candidate }: { candidate: PublishCandidate }) {
  const [state, formAction] = useActionState(publishManuscriptAction, EMPTY_RESULT);
  const [firstPage, setFirstPage] = useState("");
  const [lastPage, setLastPage] = useState("");

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="manuscriptId" value={candidate.id} />
      {candidate.editionId ? <input type="hidden" name="editionId" value={candidate.editionId} /> : null}

      {candidate.venueType === "JOURNAL" && candidate.availableIssues.length > 0 ? (
        <Field label="Journal issue" tooltip="The issue owns the publication volume and number. Publishing into an issue keeps the archive and citations consistent.">
          <select className="sb-input" name="journalIssueId" required defaultValue="">
            <option value="">Choose an open issue</option>
            {candidate.availableIssues.map((issue) => <option key={issue.id} value={issue.id}>Volume {issue.volume}, Issue {issue.number}{issue.title ? ` — ${issue.title}` : ""}</option>)}
          </select>
        </Field>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {candidate.venueType === "CONFERENCE" ? <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-900/20 dark:text-blue-100">{candidate.editionLabel ?? "No edition assigned"}{candidate.editionVolume ? ` · proceedings volume ${candidate.editionVolume}` : " · assign a volume in edition settings"}</p> : null}
        <Field
          label="Volume"
          tooltip="The volume this article belongs to. Required: an article that cannot be located in an issue cannot be cited."
        >
          <input
            className="sb-input"
            inputMode="numeric"
            min={1}
            max={9999}
            name="volume"
            required={candidate.venueType !== "CONFERENCE" || Boolean(candidate.editionId)}
            value={candidate.editionId && candidate.editionVolume ? candidate.editionVolume : undefined}
            readOnly={Boolean(candidate.editionId)}
            type="number"
          />
        </Field>

        <Field
          label="Issue (optional)"
          tooltip="Leave blank for a volume with continuous pagination."
        >
          <input
            className="sb-input"
            inputMode="numeric"
            min={1}
            max={999}
            name="issue"
            type="number"
          />
        </Field>

        <Field
          label="Published on"
          tooltip="Defaults to today. Cannot be in the future."
          hint="Leave blank for today."
        >
          <input className="sb-input" name="publishedAt" type="date" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="First page"
          tooltip="The first page in the issue. Letters and digits are allowed for e-locators such as e0123."
          hint={`${firstPage.length}/${MAX_PAGE_LENGTH} characters`}
        >
          <input
            className="sb-input"
            maxLength={MAX_PAGE_LENGTH}
            name="firstPage"
            onChange={(event) => setFirstPage(event.target.value)}
            placeholder="e.g. 101"
            value={firstPage}
          />
        </Field>

        <Field
          label="Last page"
          tooltip="The last page in the issue. Leave blank for a single-page item."
          hint={`${lastPage.length}/${MAX_PAGE_LENGTH} characters`}
        >
          <input
            className="sb-input"
            maxLength={MAX_PAGE_LENGTH}
            name="lastPage"
            onChange={(event) => setLastPage(event.target.value)}
            placeholder="e.g. 118"
            value={lastPage}
          />
        </Field>
      </div>

      {candidate.venueType === "CONFERENCE" && candidate.editionId ? <p className="text-xs text-slate-500 dark:text-slate-400">The edition owns the ISBN; this paper receives it automatically when published.</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitBtn className="sb-button-primary" loadingText="Publishing…">
          Publish
        </SubmitBtn>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Publishes immediately and appears in the public archive.
        </span>
      </div>

      <ActionResultMessage className="mt-3" state={state} />
    </form>
  );
}

export function PublishManuscriptPanel({
  candidates,
}: {
  candidates: PublishCandidate[];
}) {
  if (candidates.length === 0) {
    return (
      <p className="sb-card text-sm text-slate-500 dark:text-slate-400">
        Nothing is waiting for publication. A manuscript appears here once it is
        accepted at a venue where you are Editor-in-Chief.
      </p>
    );
  }

  return (
    <section className="sb-card" id="publication">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
        Awaiting publication
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Accepted manuscripts become public articles once a volume and page range
        are recorded.
      </p>

      <ul className="mt-4 divide-y divide-[var(--card-border)]">
        {candidates.map((candidate) => (
          <li key={candidate.id} className="py-3 first:pt-0 last:pb-0">
            <details>
              <summary className="cursor-pointer list-none">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {candidate.title}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {candidate.authorName ?? "Author not listed"} ·{" "}
                  {candidate.venueName} ·{" "}
                  {candidate.status === "ACCEPTED_JOURNAL"
                    ? "accepted"
                    : "accepted for proceedings"}
                </span>
              </summary>
              <PublishForm candidate={candidate} />
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
