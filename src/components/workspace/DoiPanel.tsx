"use client";

import { useActionState } from "react";
import { BadgeCheck, ExternalLink } from "lucide-react";

import { mintDoiAction, type DoiActionResult } from "@/app/actions/doi";
import { ActionResultMessage } from "@/components/workspace/ActionResultMessage";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

/**
 * DOI registration for one published article.
 *
 * The button is a resume button as much as a mint button: a failed or
 * interrupted deposit keeps its `zenodoDepositId`, and the action continues that
 * deposit instead of creating a second one. The status copy therefore says what
 * happened, not just "error".
 *
 * Zenodo DOIs resolve to the Zenodo record. Saying so here is deliberate — an
 * editor should not promise an author that `doi.org` lands on this site.
 */
export type DoiPanelProps = {
  manuscriptId: string;
  doi: string | null;
  status: "NONE" | "PENDING" | "MINTED" | "FAILED";
  configured: boolean;
  canMint: boolean;
};

const EMPTY_RESULT: DoiActionResult = { success: false, message: "" };

export function DoiPanel({
  manuscriptId,
  doi,
  status,
  configured,
  canMint,
}: DoiPanelProps) {
  const [state, formAction] = useActionState(mintDoiAction, EMPTY_RESULT);

  const buttonLabel =
    status === "PENDING"
      ? "Resume minting"
      : status === "FAILED"
        ? "Retry minting"
        : "Mint DOI";

  return (
    <section aria-labelledby="doi-heading" className="sb-card">
      <h2
        id="doi-heading"
        className="flex items-center gap-1.5 text-base font-semibold text-slate-950 dark:text-slate-50"
      >
        DOI
        <InfoTooltip message="Registration happens through Zenodo, which is free and issues a real DataCite DOI. The DOI resolves to the Zenodo record; the record links back to this article." />
      </h2>

      {doi ? (
        <div className="mt-3 space-y-2">
          <a
            className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
            href={`https://doi.org/${doi}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {doi}
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
          </a>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {status === "MINTED"
              ? "Registered. The DOI resolves to the Zenodo record, which cites this article as the version of record."
              : "A DOI is recorded for this article. Refresh if the status has not caught up."}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {status === "PENDING"
            ? "A mint is in progress. If this page sat open, resume it below."
            : status === "FAILED"
              ? "The last attempt did not finish. Retrying continues the same Zenodo deposit."
              : "No DOI yet. Minting registers this article with Zenodo and adds the DOI to the public page and citation downloads."}
        </p>
      )}

      {!doi && canMint ? (
        configured ? (
          <form action={formAction} className="mt-3">
            <input type="hidden" name="manuscriptId" value={manuscriptId} />
            <div className="flex flex-wrap items-center gap-3">
              <SubmitBtn className="sb-button-primary" loadingText="Talking to Zenodo…">
                {buttonLabel}
              </SubmitBtn>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Free DOI via Zenodo
              </span>
            </div>
            <ActionResultMessage className="mt-3" state={state} />
          </form>
        ) : (
          <p className="mt-3 rounded-xl border border-[var(--card-border)] p-3 text-xs text-slate-600 dark:text-slate-300">
            Zenodo is not configured yet. Add the{" "}
            <code className="font-mono">ZENODO_TOKEN</code> environment variable,
            restart the app, and this panel will mint real DOIs. No article data
            is sent until then.
          </p>
        )
      ) : null}

      {!doi && !canMint ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Only the Editor-in-Chief can mint a DOI.
        </p>
      ) : null}
    </section>
  );
}
