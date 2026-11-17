"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Upload, X } from "lucide-react";

import {
  createDirectSubmissionAction,
  createManuscriptSubmissionAction,
  createManuscriptUploadUrlAction,
  type ManuscriptSubmitResult,
} from "@/app/actions/manuscripts";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  MAX_CO_AUTHORS,
  MAX_CO_AUTHOR_AFFILIATION,
  MAX_CO_AUTHOR_EMAIL,
  MAX_CO_AUTHOR_NAME,
  MAX_CO_AUTHOR_ORCID,
} from "@/lib/publishing/coauthors";
import { CitationAuthor } from "@/lib/publishing/citations";
import {
  isPdfUpload,
  MANUSCRIPT_BUCKET,
  MANUSCRIPT_PDF_MIME,
  MAX_MANUSCRIPT_ABSTRACT,
  MAX_MANUSCRIPT_BYTES,
  MAX_MANUSCRIPT_KEYWORDS,
  MAX_MANUSCRIPT_SIZE_LABEL,
  MAX_MANUSCRIPT_TITLE,
} from "@/lib/publishing/constants";
import { formatFileSize } from "@/lib/format";
import { createClient } from "@/utils/supabase/client";

/**
 * One submission form for both entry points.
 *
 * A direct submission to a venue and an invited extended version ask the same
 * questions and share the same upload path; only the action called at the end
 * differs. Keeping one component means a new field or a new validation rule
 * cannot appear on one route and be missing from the other.
 */
export type ManuscriptSubmissionProps =
  | {
      kind: "invitation";
      invitationId: string;
      sourceTitle: string;
      sourceVenueName: string;
      targetVenueName: string;
      initialTitle: string;
      initialAbstract: string;
      initialKeywords: string;
      initialCoAuthors: readonly {
        name: string;
        affiliation?: string | null;
        orcid?: string | null;
        email?: string | null;
      }[];
      defaultAuthor: {
        name: string;
        email: string;
        orcid: string | null;
      };
      initialCorrespondingAuthor: (CitationAuthor & { email?: string | null }) | null;
    }
  | {
      kind: "direct";
      venueSlug: string;
      venueName: string;
      venueType: "JOURNAL" | "CONFERENCE";
      defaultAuthor: {
        name: string;
        email: string;
        orcid: string | null;
      };
      initialCorrespondingAuthor: (CitationAuthor & { email?: string | null }) | null;
    };

const EMPTY_RESULT: ManuscriptSubmitResult = { success: false, message: "" };

type UploadStage = "idle" | "hashing" | "uploading" | "submitting";

const STAGE_LABELS: Record<Exclude<UploadStage, "idle">, string> = {
  hashing: "Checksumming your PDF…",
  uploading: "Uploading your PDF…",
  submitting: "Recording your submission…",
};

type CoAuthorRow = {
  key: string;
  name: string;
  affiliation: string;
  orcid: string;
  email: string;
};

function emptyCoAuthor(): CoAuthorRow {
  return { key: crypto.randomUUID(), name: "", affiliation: "", orcid: "", email: "" };
}

/**
 * Initial co-author rows. Invitation mode pre-fills the conference byline with
 * deterministic keys so the server and client render identical markup; a random
 * key would produce a hydration mismatch on the input ids.
 */
function initialCoAuthorRows(props: ManuscriptSubmissionProps): CoAuthorRow[] {
  if (props.kind !== "invitation") return [];

  return props.initialCoAuthors.map((author, index) => ({
    key: `initial-${index}`,
    name: author.name,
    affiliation: author.affiliation ?? "",
    orcid: author.orcid ?? "",
    email: author.email ?? "",
  }));
}

async function sha256File(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The hidden payload the Server Action parses. Entries the author never filled
 * in are dropped rather than sent as blank names; a partly filled row is sent
 * so the server can reject it with a specific message.
 */
function serializeCoAuthors(rows: readonly CoAuthorRow[]): string {
  const filled = rows.filter(
    (row) =>
      row.name.trim() || row.affiliation.trim() || row.orcid.trim() || row.email.trim(),
  );

  return JSON.stringify(
    filled.map((row) => ({
      name: row.name.trim(),
      ...(row.affiliation.trim() ? { affiliation: row.affiliation.trim() } : {}),
      ...(row.orcid.trim() ? { orcid: row.orcid.trim() } : {}),
      ...(row.email.trim() ? { email: row.email.trim() } : {}),
    })),
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  const over = value > max;
  return (
    <div
      className={
        over
          ? "mt-1 text-xs text-red-600 dark:text-red-400"
          : "mt-1 text-xs text-slate-500 dark:text-slate-400"
      }
    >
      {value}/{max} characters
    </div>
  );
}

function Field({
  id,
  label,
  tooltip,
  counter,
  children,
}: {
  id: string;
  label: string;
  tooltip: string;
  counter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="sb-label inline-flex items-center gap-1.5">
        {label}
        <InfoTooltip message={tooltip} />
      </label>
      {children}
      {counter ? <div className="mt-1">{counter}</div> : null}
    </div>
  );
}

export function ManuscriptSubmissionForm(props: ManuscriptSubmissionProps) {
  const router = useRouter();
  const isInvitation = props.kind === "invitation";
  const venueName = isInvitation ? props.targetVenueName : props.venueName;
  const venueType = isInvitation ? "JOURNAL" : props.venueType;
  const noun = venueType === "JOURNAL" ? "article" : "paper";

  const [title, setTitle] = useState(
    isInvitation ? props.initialTitle.slice(0, MAX_MANUSCRIPT_TITLE) : "",
  );
  const [abstractText, setAbstractText] = useState(
    isInvitation ? props.initialAbstract.slice(0, MAX_MANUSCRIPT_ABSTRACT) : "",
  );
  const [keywords, setKeywords] = useState(
    isInvitation ? props.initialKeywords.slice(0, MAX_MANUSCRIPT_KEYWORDS) : "",
  );
  const [coAuthors, setCoAuthors] = useState<CoAuthorRow[]>(() =>
    initialCoAuthorRows(props),
  );
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [error, setError] = useState("");

  const busy = stage !== "idle";
  const stageLabel = stage === "idle" ? "" : STAGE_LABELS[stage];
  const overLimit =
    title.length > MAX_MANUSCRIPT_TITLE ||
    abstractText.length > MAX_MANUSCRIPT_ABSTRACT ||
    keywords.length > MAX_MANUSCRIPT_KEYWORDS;

  function acceptFile(selected: File | null) {
    setError("");

    if (!selected) {
      setFile(null);
      return;
    }
    if (!isPdfUpload(selected)) {
      setError("The manuscript must be a PDF.");
      setFile(null);
      return;
    }
    if (selected.size <= 0 || selected.size > MAX_MANUSCRIPT_BYTES) {
      setError(`The PDF must be smaller than ${MAX_MANUSCRIPT_SIZE_LABEL}.`);
      setFile(null);
      return;
    }

    setFile(selected);
  }

  function updateCoAuthor(key: string, patch: Partial<CoAuthorRow>) {
    setCoAuthors((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Choose the manuscript PDF first.");
      return;
    }
    if (!title.trim()) {
      setError("Add a title for the manuscript.");
      return;
    }
    if (!abstractText.trim()) {
      setError("Add an abstract for the manuscript.");
      return;
    }
    if (overLimit) {
      setError("Shorten the fields marked over their limit.");
      return;
    }

    const filledRows = coAuthors.filter(
      (row) =>
        row.name.trim() || row.affiliation.trim() || row.orcid.trim() || row.email.trim(),
    );
    if (filledRows.some((row) => !row.name.trim())) {
      setError("Every co-author row needs a name, or remove the row.");
      return;
    }

    try {
      setStage("hashing");
      const sha256 = await sha256File(file);

      setStage("uploading");
      const ticket = await createManuscriptUploadUrlAction();
      if (!ticket.success) {
        setError(ticket.message);
        return;
      }

      const storage = createClient();
      // Some browsers report an empty MIME type for a real PDF. Send an
      // explicit type so Storage stores a content type the server can verify.
      const uploadBody =
        file.type === MANUSCRIPT_PDF_MIME
          ? file
          : new Blob([file], { type: MANUSCRIPT_PDF_MIME });

      const { error: uploadError } = await storage.storage
        .from(MANUSCRIPT_BUCKET)
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, uploadBody);

      if (uploadError) {
        setError("The PDF upload failed. Please try again.");
        return;
      }

      setStage("submitting");
      const formData = new FormData();
      if (isInvitation) {
        formData.set("invitationId", props.invitationId);
      } else {
        formData.set("venueSlug", props.venueSlug);
      }
      formData.set("title", title.trim());
      formData.set("abstract", abstractText.trim());
      formData.set("keywords", keywords.trim());
      formData.set("coAuthors", serializeCoAuthors(coAuthors));
      formData.set("filePath", ticket.data.path);
      formData.set("fileName", file.name);
      formData.set("fileSize", String(file.size));
      formData.set("sha256", sha256);

      const result = isInvitation
        ? await createManuscriptSubmissionAction(EMPTY_RESULT, formData)
        : await createDirectSubmissionAction(EMPTY_RESULT, formData);
      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push(`/workspace/submissions/${result.data.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setStage("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="sb-card bg-slate-50 text-sm dark:bg-slate-900/40">
        {isInvitation ? (
          <>
            <p className="font-medium">Extending {props.sourceTitle}</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              From {props.sourceVenueName} to {venueName}. Your conference paper
              and its acceptance decision are not changed.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">
              New submission to {venueName}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              You submit as the corresponding author. The editor is notified and
              the {noun} keeps a status timeline you can follow from your
              workspace.
            </p>
          </>
        )}
      </div>

      <section className="sb-card space-y-5">
        <header>
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
            Manuscript
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            What reviewers and the published record will show.
          </p>
        </header>

        <Field
          id="manuscript-title"
          label="Title"
          tooltip={`The full title of the ${noun}. It appears in the archive, the citation, and the PDF metadata.`}
          counter={<Counter value={title.length} max={MAX_MANUSCRIPT_TITLE} />}
        >
          <input
            id="manuscript-title"
            name="title"
            className="sb-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={MAX_MANUSCRIPT_TITLE}
            required
          />
        </Field>

        <Field
          id="manuscript-abstract"
          label="Abstract"
          tooltip="A self-contained summary: question, method, results, conclusion. Reviewers are assigned against this text and it is shown on the public article page."
          counter={<Counter value={abstractText.length} max={MAX_MANUSCRIPT_ABSTRACT} />}
        >
          <textarea
            id="manuscript-abstract"
            name="abstract"
            className="sb-textarea min-h-[180px]"
            value={abstractText}
            onChange={(event) => setAbstractText(event.target.value)}
            maxLength={MAX_MANUSCRIPT_ABSTRACT}
            required
          />
        </Field>

        <Field
          id="manuscript-keywords"
          label="Keywords"
          tooltip="Comma-separated, up to 8. They feed reviewer matching and the article metadata; keep them specific to the paper."
          counter={<Counter value={keywords.length} max={MAX_MANUSCRIPT_KEYWORDS} />}
        >
          <input
            id="manuscript-keywords"
            name="keywords"
            className="sb-input"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            maxLength={MAX_MANUSCRIPT_KEYWORDS}
            placeholder="optics, telemedicine, low-resource settings"
          />
        </Field>
      </section>

      <section className="sb-card">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              Authors
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              You are the corresponding author, taken from your account. List
              co-authors in the order they should appear.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCoAuthors((current) => [...current, emptyCoAuthor()])}
            disabled={coAuthors.length >= MAX_CO_AUTHORS || busy}
            className="sb-button-soft inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add co-author
          </button>
        </header>

        {coAuthors.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--card-border)] px-3 py-4 text-xs text-slate-500 dark:text-slate-400">
            No co-authors added. A single-author paper is fine — add a row only
            for someone whose name belongs in the byline.
          </p>
        ) : (
          <ol className="mt-4 space-y-4">
            {coAuthors.map((row, index) => (
              <li
                key={row.key}
                className="rounded-xl border border-[var(--card-border)] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Co-author {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setCoAuthors((current) =>
                        current.filter((item) => item.key !== row.key),
                      )
                    }
                    disabled={busy}
                    className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label={`Remove co-author ${index + 1}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`coauthor-name-${row.key}`}
                      className="sb-label inline-flex items-center gap-1.5"
                    >
                      Name
                      <InfoTooltip message="The name exactly as it should appear in the published byline. Use initials if that is how the author publishes." />
                    </label>
                    <input
                      id={`coauthor-name-${row.key}`}
                      className="sb-input"
                      value={row.name}
                      maxLength={MAX_CO_AUTHOR_NAME}
                      onChange={(event) =>
                        updateCoAuthor(row.key, { name: event.target.value })
                      }
                      placeholder="Asha Rao"
                    />
                    <Counter value={row.name.length} max={MAX_CO_AUTHOR_NAME} />
                  </div>

                  <div>
                    <label
                      htmlFor={`coauthor-affiliation-${row.key}`}
                      className="sb-label inline-flex items-center gap-1.5"
                    >
                      Affiliation
                      <InfoTooltip message="Institution, department, or city shown under the author's name. Leave blank when there is no institutional affiliation." />
                    </label>
                    <input
                      id={`coauthor-affiliation-${row.key}`}
                      className="sb-input"
                      value={row.affiliation}
                      maxLength={MAX_CO_AUTHOR_AFFILIATION}
                      onChange={(event) =>
                        updateCoAuthor(row.key, { affiliation: event.target.value })
                      }
                      placeholder="IISc Bengaluru"
                    />
                    <Counter
                      value={row.affiliation.length}
                      max={MAX_CO_AUTHOR_AFFILIATION}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`coauthor-orcid-${row.key}`}
                      className="sb-label inline-flex items-center gap-1.5"
                    >
                      ORCID iD (optional)
                      <InfoTooltip message="Persistent researcher identifier in the form 0000-0002-1825-0097. It links the byline to the author's ORCID record." />
                    </label>
                    <input
                      id={`coauthor-orcid-${row.key}`}
                      className="sb-input"
                      value={row.orcid}
                      maxLength={MAX_CO_AUTHOR_ORCID}
                      onChange={(event) =>
                        updateCoAuthor(row.key, { orcid: event.target.value })
                      }
                      placeholder="0000-0002-1825-0097"
                    />
                    <Counter
                      value={row.orcid.length}
                      max={MAX_CO_AUTHOR_ORCID}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`coauthor-email-${row.key}`}
                      className="sb-label inline-flex items-center gap-1.5"
                    >
                      Email (optional)
                      <InfoTooltip message="Used only for editorial correspondence about this manuscript. It is never shown on the published article." />
                    </label>
                    <input
                      id={`coauthor-email-${row.key}`}
                      className="sb-input"
                      type="email"
                      value={row.email}
                      maxLength={MAX_CO_AUTHOR_EMAIL}
                      onChange={(event) =>
                        updateCoAuthor(row.key, { email: event.target.value })
                      }
                      placeholder="asha@example.edu"
                    />
                    <Counter
                      value={row.email.length}
                      max={MAX_CO_AUTHOR_EMAIL}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="sb-card">
        <header>
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
            Version of record
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            PDF only, up to {MAX_MANUSCRIPT_SIZE_LABEL}. The file is stored
            privately and is never served without a short-lived signed link.
          </p>
        </header>

        <label
          htmlFor="manuscript-file"
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) acceptFile(event.dataTransfer.files?.[0] ?? null);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
              : "border-[var(--card-border)] hover:border-slate-400 dark:hover:border-slate-500"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            id="manuscript-file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
            disabled={busy}
            className="sr-only"
            required
          />
          <Upload className="h-6 w-6 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          {file ? (
            <>
              <span className="mt-3 break-all text-sm font-medium text-slate-900 dark:text-slate-100">
                {file.name}
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(file.size)} · click to replace
              </span>
            </>
          ) : (
            <>
              <span className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                Drop your PDF here, or browse
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                A tagged, accessible PDF is preferred.
              </span>
            </>
          )}
        </label>
      </section>

      <p
        role={error ? "alert" : undefined}
        className={
          error
            ? "rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300"
            : "hidden"
        }
      >
        {error}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || overLimit}
          className="sb-button-primary"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {stageLabel}
            </span>
          ) : (
            `Submit to ${venueName}`
          )}
        </button>
        <Link
          href="/workspace/submissions"
          className="sb-button-soft"
          aria-disabled={busy}
        >
          Cancel
        </Link>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          You can withdraw before a decision is made.
        </span>
      </div>
    </form>
  );
}
