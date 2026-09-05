"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContribution,
  updateContribution,
} from "@/app/actions/contributions";
import {
  uploadImage,
  deleteFromCloudinary,
} from "@/app/actions/cloudinary";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useToast } from "@/components/ui/Toast";
import { useFormDraft } from "@/hooks/useFormDraft";
import { upsertToList } from "@/utils/cacheMutation";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { Editor } from "@/components/ui/Editor";
import type { ContributionWithAuthor } from "@/types/cards";
import {
  MAX_CONTRIBUTION_TITLE,
  MAX_CONTRIBUTION_UPI_ID,
  MAX_CONTRIBUTION_MESSAGE,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  CONTRIBUTION_TITLE_TIP,
  CONTRIBUTION_PAYMENT_METHOD_TIP,
  CONTRIBUTION_AMOUNT_TIP,
  CONTRIBUTION_UPI_ID_TIP,
  CONTRIBUTION_SCREENSHOT_TIP,
  CONTRIBUTION_MESSAGE_TIP,
} from "@/constants/tooltips";

export type ContributionFormValues = {
  title: string;
  message: string;
  amount: string;
  upiId: string;
  paymentMethod: string;
  screenshotUrl: string;
};

const PAYMENT_METHODS = [
  { value: "", label: "Select payment method" },
  { value: "UPI", label: "UPI" },
  { value: "NetBanking", label: "NetBanking" },
  { value: "Google Pay", label: "Google Pay" },
  { value: "PhonePe", label: "PhonePe" },
  { value: "PayPal", label: "PayPal" },
  { value: "Other", label: "Other" },
];

export default function ContributionForm({
  mode,
  contributionId,
  contributionStatus,
  initialValues,
}: {
  mode: "create" | "edit";
  contributionId?: string;
  contributionStatus?: string;
  initialValues?: Partial<ContributionFormValues>;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isApprovedEdit = mode === "edit" && contributionStatus === "APPROVED";

  const draftKey = mode === "edit" ? null : "draft_contribution_create";
  const [draftFields, updateDraftField, resetDraft, isRestored] = useFormDraft(
    draftKey,
    {
      title: initialValues?.title ?? "",
      message: initialValues?.message ?? "",
      amount: initialValues?.amount ?? "",
      upiId: initialValues?.upiId ?? "",
      paymentMethod: initialValues?.paymentMethod ?? "",
      screenshotUrl: initialValues?.screenshotUrl ?? "",
    },
  );

  const [screenshotUrl, setScreenshotUrl] = useState(
    initialValues?.screenshotUrl ?? "",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore screenshotUrl from draft once hydration completes
  useEffect(() => {
    if (isRestored && draftFields.screenshotUrl) {
      setScreenshotUrl(draftFields.screenshotUrl);
    }
  }, [isRestored, draftFields.screenshotUrl]);

  // Persist screenshotUrl in draft — gated on isRestored so the initial mount
  // does not clobber a restored draft screenshot with the empty initial value.
  useEffect(() => {
    if (!isRestored) return;
    // If the draft has a screenshot but the state hasn't been synced yet, skip
    // this render — the restore effect will set screenshotUrl and re-run.
    if (draftFields.screenshotUrl && !screenshotUrl) return;
    updateDraftField("screenshotUrl", screenshotUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenshotUrl, isRestored, draftFields.screenshotUrl]);

  const isMessageOverLimit =
    getRichTextLength(draftFields.message) > MAX_CONTRIBUTION_MESSAGE;
  const isFormOverLimit = isMessageOverLimit;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) {
      toast(`Message exceeds the ${MAX_CONTRIBUTION_MESSAGE}-character limit.`, "error");
      return;
    }
    const formData = new FormData(e.currentTarget);
    setSubmitting(true);

    try {
      if (mode === "edit" && contributionId) {
        const result = await updateContribution(contributionId, formData);
        if (result?.success) {
          if (isApprovedEdit && result.data) {
            upsertToList<ContributionWithAuthor>(
              queryClient,
              ["contributions"],
              result.data as ContributionWithAuthor,
              "edit",
            );
          }
          toast("Contribution updated successfully!");
          router.push(`/contributions/${result.data.id}`);
        }
      } else {
        const result = await createContribution(formData);
        if (result?.success) {
          resetDraft();
          if (result.data) {
            router.push(`/contributions/${result.data.id}`);
          } else {
            router.push("/contributions");
          }
        }
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to submit contribution.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Client-Side Validation
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5MB.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const data = await uploadImage(fd, "post");
      const newUrl = data.url;

      // Replacing an existing screenshot: delete the old one to avoid
      // orphaned Cloudinary assets (only in create mode; edit mode deletes
      // after successful server-side save).
      if (screenshotUrl && screenshotUrl !== newUrl && mode === "create") {
        await deleteFromCloudinary(screenshotUrl);
      }

      setScreenshotUrl(newUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload screenshot.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveScreenshot() {
    if (!screenshotUrl) return;

    // In edit mode, don't delete immediately — the server action will delete
    // the old screenshot only after a successful save (so the user can change
    // their mind before submitting). In create mode, delete right away since
    // the image isn't referenced anywhere yet.
    if (mode === "create") {
      await deleteFromCloudinary(screenshotUrl);
    }

    setScreenshotUrl("");
    setUploadError("");
    updateDraftField("screenshotUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      {!isApprovedEdit && (
        <div className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-4 text-sm dark:border-blue-500/20 dark:bg-blue-500/10">
          <h3 className="mb-2 font-semibold text-blue-700 dark:text-blue-300">
            Account Information
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Your contributions help maintain the server, database, and overall
            development of ScholarBase. Please send your donation to the
            following UPI ID:
          </p>
          <p className="mt-2 font-mono font-bold text-blue-800 dark:text-blue-200">
            scholarbase@upi
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            After sending, fill in the details below so we can track and approve
            your contribution.
          </p>
        </div>
      )}

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Title
          <InfoTooltip message={CONTRIBUTION_TITLE_TIP} />
        </label>
        <input
          name="title"
          placeholder="e.g., Server Maintenance Contribution"
          className="sb-input"
          required
          maxLength={MAX_CONTRIBUTION_TITLE}
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.title.length}/{MAX_CONTRIBUTION_TITLE} characters
        </div>
      </div>

      {!isApprovedEdit && (
        <>
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Payment Method
              <InfoTooltip message={CONTRIBUTION_PAYMENT_METHOD_TIP} />
            </label>
            <input
              type="hidden"
              name="paymentMethod"
              value={draftFields.paymentMethod}
            />
            <select
              name="paymentMethod"
              className="sb-select"
              required
              value={draftFields.paymentMethod}
              onChange={(e) =>
                updateDraftField("paymentMethod", e.target.value)
              }
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="sb-label inline-flex items-center gap-1.5">
                Amount (₹, Optional)
                <InfoTooltip message={CONTRIBUTION_AMOUNT_TIP} />
              </label>
              <input
                type="number"
                min="10"
                max="100000"
                step="10"
                name="amount"
                placeholder="e.g., 500"
                className="sb-input"
                value={draftFields.amount}
                onChange={(e) => updateDraftField("amount", e.target.value)}
              />
            </div>
            <div>
              <label className="sb-label inline-flex items-center gap-1.5">
                Transaction ID / UPI ID (Optional)
                <InfoTooltip message={CONTRIBUTION_UPI_ID_TIP} />
              </label>
              <input
                name="upiId"
                placeholder="e.g., xyz@upi or TXN12345"
                className="sb-input"
                maxLength={MAX_CONTRIBUTION_UPI_ID}
                value={draftFields.upiId}
                onChange={(e) => updateDraftField("upiId", e.target.value)}
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {draftFields.upiId.length}/{MAX_CONTRIBUTION_UPI_ID} characters
              </div>
            </div>
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Payment Screenshot (Optional)
              <InfoTooltip message={CONTRIBUTION_SCREENSHOT_TIP} />
            </label>
            <div className="mt-1 flex items-center gap-4">
              <label className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50">
                <span>{uploading ? "Uploading..." : "Choose Image"}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              {screenshotUrl && (
                <span className="text-xs text-green-600 font-semibold">
                  ✓ Screenshot uploaded
                </span>
              )}
            </div>
            {uploadError && (
              <p className="mt-1 text-xs text-red-500 font-medium">
                {uploadError}
              </p>
            )}
            {screenshotUrl && (
              <div className="relative group mt-2 w-fit">
                <Image
                  src={screenshotUrl}
                  alt="Payment screenshot preview"
                  width={320}
                  height={160}
                  unoptimized
                  className="h-32 w-auto rounded-lg border border-slate-200 object-cover shadow-sm dark:border-slate-700"
                />
                {/* Always-visible remove button (works on touch/mobile) */}
                <button
                  type="button"
                  onClick={handleRemoveScreenshot}
                  aria-label="Remove screenshot"
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow-sm hover:bg-red-600"
                >
                  ×
                </button>
                {/* Hover overlay: Remove image (desktop) */}
                <div
                  onClick={handleRemoveScreenshot}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <span className="text-xs font-semibold text-white">
                    Remove
                  </span>
                </div>
              </div>
            )}
            <input type="hidden" name="screenshotUrl" value={screenshotUrl} />
          </div>
        </>
      )}

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Message
          <InfoTooltip message={CONTRIBUTION_MESSAGE_TIP} />
        </label>
        <Editor
          maxLength={MAX_CONTRIBUTION_MESSAGE}
          value={draftFields.message}
          onChange={(data) => updateDraftField("message", data)}
        />
        <input type="hidden" name="message" value={draftFields.message} />
      </div>

      {!isApprovedEdit && (
        <div className="rounded-xl border border-amber-100/50 bg-amber-50/50 p-3 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          Your contribution will be reviewed by an admin and will appear on the
          site once approved.
        </div>
      )}

      {isApprovedEdit && (
        <div className="rounded-xl border border-blue-100/50 bg-blue-100/50 p-3 text-xs font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
          This contribution has been approved. You can only edit the title and
          message. Contact admin for other changes.
        </div>
      )}

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth
          className="sb-button-accent"
          loadingText="Submitting..."
          disabled={submitting || isFormOverLimit}
        >
          {mode === "edit" ? "Save Changes" : "Submit Contribution"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
