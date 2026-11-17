"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  createManuscriptSubmissionAction,
  createManuscriptUploadUrlAction,
  type ManuscriptSubmitResult,
} from "@/app/actions/manuscripts";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
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
import { createClient } from "@/utils/supabase/client";

export type ManuscriptSubmissionProps = {
  invitationId: string;
  sourceTitle: string;
  sourceVenueName: string;
  targetVenueName: string;
  initialTitle: string;
  initialAbstract: string;
  initialKeywords: string;
};

const EMPTY_RESULT: ManuscriptSubmitResult = { success: false, message: "" };

type UploadStage = "idle" | "hashing" | "uploading" | "submitting";

const STAGE_LABELS: Record<Exclude<UploadStage, "idle">, string> = {
  hashing: "Checksumming your PDF…",
  uploading: "Uploading your PDF…",
  submitting: "Recording your submission…",
};

async function sha256File(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

/**
 * Acceptance form for a conference → journal invitation.
 *
 * The PDF goes browser → Supabase through a signed ticket; only the path and
 * digest reach the Server Action. Progress is explicit because hashing and
 * uploading a 25 MB file can take several seconds, and a silent button is what
 * makes authors click twice.
 */
export function ManuscriptSubmissionForm({
  invitationId,
  sourceTitle,
  sourceVenueName,
  targetVenueName,
  initialTitle,
  initialAbstract,
  initialKeywords,
}: ManuscriptSubmissionProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle.slice(0, MAX_MANUSCRIPT_TITLE));
  const [abstractText, setAbstractText] = useState(
    initialAbstract.slice(0, MAX_MANUSCRIPT_ABSTRACT),
  );
  const [keywords, setKeywords] = useState(
    initialKeywords.slice(0, MAX_MANUSCRIPT_KEYWORDS),
  );
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [error, setError] = useState("");

  const busy = stage !== "idle";
  const stageLabel = stage === "idle" ? "" : STAGE_LABELS[stage];
  const overLimit =
    title.length > MAX_MANUSCRIPT_TITLE ||
    abstractText.length > MAX_MANUSCRIPT_ABSTRACT ||
    keywords.length > MAX_MANUSCRIPT_KEYWORDS;

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Choose the manuscript PDF first.");
      return;
    }
    if (!title.trim()) {
      setError("Add a title for the extended version.");
      return;
    }
    if (!abstractText.trim()) {
      setError("Add an abstract for the extended version.");
      return;
    }
    if (overLimit) {
      setError("Shorten the fields marked over their limit.");
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
      formData.set("invitationId", invitationId);
      formData.set("title", title.trim());
      formData.set("abstract", abstractText.trim());
      formData.set("keywords", keywords.trim());
      formData.set("filePath", ticket.data.path);
      formData.set("fileName", file.name);
      formData.set("fileSize", String(file.size));
      formData.set("sha256", sha256);

      const result = await createManuscriptSubmissionAction(
        EMPTY_RESULT,
        formData,
      );
      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push("/workspace/submissions");
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
        <p className="font-medium">Extending {sourceTitle}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          From {sourceVenueName} to {targetVenueName}. Your conference paper and
          its acceptance decision are not changed.
        </p>
      </div>

      <div>
        <label
          htmlFor="manuscript-title"
          className="sb-label inline-flex items-center gap-1.5"
        >
          Title
          <InfoTooltip message="The title of the extended version. It can differ from the conference paper, but journals expect the relationship to be stated." />
        </label>
        <input
          id="manuscript-title"
          name="title"
          className="sb-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_MANUSCRIPT_TITLE}
          required
        />
        <Counter value={title.length} max={MAX_MANUSCRIPT_TITLE} />
      </div>

      <div>
        <label
          htmlFor="manuscript-abstract"
          className="sb-label inline-flex items-center gap-1.5"
        >
          Abstract
          <InfoTooltip message="At least 30% new material is the usual expectation for an extended conference paper. The abstract is what reviewers are assigned against." />
        </label>
        <textarea
          id="manuscript-abstract"
          name="abstract"
          className="sb-textarea min-h-[160px]"
          value={abstractText}
          onChange={(event) => setAbstractText(event.target.value)}
          maxLength={MAX_MANUSCRIPT_ABSTRACT}
          required
        />
        <Counter value={abstractText.length} max={MAX_MANUSCRIPT_ABSTRACT} />
      </div>

      <div>
        <label
          htmlFor="manuscript-keywords"
          className="sb-label inline-flex items-center gap-1.5"
        >
          Keywords
          <InfoTooltip message="Comma-separated, up to 8. They feed reviewer matching and the article metadata; keep them specific to the paper." />
        </label>
        <input
          id="manuscript-keywords"
          name="keywords"
          className="sb-input"
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
          maxLength={MAX_MANUSCRIPT_KEYWORDS}
          placeholder="optics, telemedicine, low-resource settings"
        />
        <Counter value={keywords.length} max={MAX_MANUSCRIPT_KEYWORDS} />
      </div>

      <div>
        <label
          htmlFor="manuscript-file"
          className="sb-label inline-flex items-center gap-1.5"
        >
          Manuscript PDF
          <InfoTooltip message="The PDF is the version of record and is stored privately. Reviewers receive a short-lived signed link, never a public URL." />
        </label>
        <input
          id="manuscript-file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={onFileChange}
          disabled={busy}
          className="block w-full cursor-pointer rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white dark:file:bg-slate-100 dark:file:text-slate-900"
          required
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          PDF only, up to {MAX_MANUSCRIPT_SIZE_LABEL}.
          {file ? ` Selected: ${file.name}` : ""}
        </p>
      </div>

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
            `Submit to ${targetVenueName}`
          )}
        </button>
        <Link
          href="/workspace/submissions"
          className="sb-button-soft"
          aria-disabled={busy}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
