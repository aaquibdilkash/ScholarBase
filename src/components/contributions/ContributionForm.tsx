"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createContribution,
  updateContribution,
} from "@/app/actions/contributions";
import { generateCloudinarySignature } from "@/app/actions/cloudinary";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useToast } from "@/components/ui/Toast";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Editor } from "@/components/ui/Editor";

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
  isLoggedIn,
}: {
  mode: "create" | "edit";
  contributionId?: string;
  contributionStatus?: string;
  initialValues?: Partial<ContributionFormValues>;
  isLoggedIn?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { openAuthModal } = useAuthModal();

  const isApprovedEdit = mode === "edit" && contributionStatus === "APPROVED";

  // Draft persistence for create mode
  const draftKey = `draft_contribution_${mode}`;
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

  // Restore screenshotUrl from draft on mount
  useEffect(() => {
    if (isRestored && draftFields.screenshotUrl) {
      setScreenshotUrl(draftFields.screenshotUrl);
    }
  }, [isRestored, draftFields.screenshotUrl]);

  // Persist screenshotUrl in draft when it changes (only after restoration is complete)
  useEffect(() => {
    if (isRestored) {
      updateDraftField("screenshotUrl", screenshotUrl);
    }
  }, [screenshotUrl, updateDraftField, isRestored]);

  async function handleSubmit(formData: FormData) {
    if (mode === "create" && !isLoggedIn) {
      openAuthModal();
      return;
    }
    setSubmitting(true);

    if (mode === "edit" && contributionId) {
      // updateContribution still redirects server-side
      await updateContribution(contributionId, formData);
    } else {
      const result = await createContribution(formData);
      if (result?.success) {
        resetDraft();
        toast(
          "Contribution submitted successfully! It will be reviewed by an admin.",
        );
        setTimeout(() => {
          router.push("/contributions");
        }, 1500);
      }
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
      // 2. Fetch cryptographically signed authorization parameters
      const { timestamp, signature, apiKey, cloudName, folder } =
        await generateCloudinarySignature();

      // 3. Assemble signed payload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", folder);

      // 4. Direct browser-to-edge upload
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Upload failed");
      }

      const data = await res.json();
      setScreenshotUrl(data.secure_url);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload screenshot.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      {!isApprovedEdit && (
        <div className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-4 text-sm">
          <h3 className="mb-2 font-semibold text-blue-700">
            Account Information
          </h3>
          <p className="text-slate-600">
            Your contributions help maintain the server, database, and overall
            development of ScholarBase. Please send your donation to the
            following UPI ID:
          </p>
          <p className="mt-2 font-mono font-bold text-blue-800">
            scholarbase@upi
          </p>
          <p className="mt-1 text-xs text-slate-500">
            After sending, fill in the details below so we can track and approve
            your contribution.
          </p>
        </div>
      )}

      <div>
        <label className="sb-label">Title</label>
        <input
          name="title"
          placeholder="e.g., Server Maintenance Contribution"
          className="sb-input"
          required
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
      </div>

      {!isApprovedEdit && (
        <>
          <div>
            <label className="sb-label">Payment Method</label>
            <select
              name="paymentMethod"
              className="sb-input"
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
              <label className="sb-label">Amount (Optional)</label>
              <input
                type="number"
                min="1"
                step="1"
                name="amount"
                placeholder="e.g., 500"
                className="sb-input"
                value={draftFields.amount}
                onChange={(e) => updateDraftField("amount", e.target.value)}
              />
            </div>
            <div>
              <label className="sb-label">
                Transaction ID / UPI ID (Optional)
              </label>
              <input
                name="upiId"
                placeholder="e.g., xyz@upi or TXN12345"
                className="sb-input"
                value={draftFields.upiId}
                onChange={(e) => updateDraftField("upiId", e.target.value)}
              />
            </div>
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="sb-label">Payment Screenshot (Optional)</label>
            <div className="mt-1 flex items-center gap-4">
              <label className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50">
                <span>{uploading ? "Uploading..." : "Choose Image"}</span>
                <input
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
              <div className="mt-2">
                <img
                  src={screenshotUrl}
                  alt="Payment screenshot preview"
                  className="h-32 w-auto rounded-lg border border-slate-200 object-cover shadow-sm"
                />
              </div>
            )}
            <input type="hidden" name="screenshotUrl" value={screenshotUrl} />
          </div>
        </>
      )}

      <div>
        <label className="sb-label">Message</label>
        <Editor
          value={draftFields.message}
          onChange={(data) => updateDraftField("message", data)}
        />
        <input type="hidden" name="message" value={draftFields.message} />
      </div>

      {!isApprovedEdit && (
        <div className="rounded-xl border border-amber-100/50 bg-amber-50/50 p-3 text-xs font-medium text-amber-700">
          Your contribution will be reviewed by an admin and will appear on the
          site once approved.
        </div>
      )}

      {isApprovedEdit && (
        <div className="rounded-xl border border-blue-100/50 bg-blue-100/50 p-3 text-xs font-medium text-blue-700">
          This contribution has been approved. You can only edit the title and
          message. Contact admin for other changes.
        </div>
      )}

      <SubmitBtnWithAuth
        className="sb-button-accent mt-2 self-end"
        loadingText="Submitting..."
      >
        {mode === "edit" ? "Save Changes" : "Submit Contribution"}
      </SubmitBtnWithAuth>
    </form>
  );
}
