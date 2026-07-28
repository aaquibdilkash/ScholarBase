"use client";

import { useRef, useState, useEffect } from "react";
import { createSocialPost } from "@/app/actions/feed";
import { generateCloudinarySignature } from "@/app/actions/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";

export function CreateSocialPostForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [draftFields, updateDraftField, resetDraft, isRestored] = useFormDraft(
    "draft_social_post",
    { content: "", imageUrls: [] },
  );

  // Restore image URLs from draft on mount — only depends on isRestored
  // to break the circular dependency with the sync effect below.
  useEffect(() => {
    if (
      isRestored &&
      draftFields.imageUrls &&
      Array.isArray(draftFields.imageUrls)
    ) {
      setImageUrls(draftFields.imageUrls);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestored]);

  // Persist image URLs in draft (only after restoration is complete)
  useEffect(() => {
    if (isRestored) {
      updateDraftField("imageUrls", imageUrls);
    }
  }, [imageUrls, updateDraftField, isRestored]);

  const { submitting, submit } = useFormSubmit(
    () => {
      resetDraft();
      setImageUrls([]);
    },
    {
      resetOnSuccess: true,
      successMessage: "Post published successfully!",
      errorMessage: "Failed to create post.",
    },
  );

  const handleSubmit = async (formData: FormData) => {
    if (uploading) {
      toast("Please wait for images to finish uploading.", "error");
      return;
    }
    imageUrls.forEach((url) => formData.append("imageUrls", url));
    await submit(() => createSocialPost(formData));
    formRef.current?.reset();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please upload an image file.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be less than 5MB.", "error");
      return;
    }

    setUploading(true);
    try {
      const { timestamp, signature, apiKey, cloudName, folder } =
        await generateCloudinarySignature();

      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", apiKey);
      fd.append("timestamp", String(timestamp));
      fd.append("signature", signature);
      fd.append("folder", folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: fd },
      );

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrls((prev) => [...prev, data.secure_url]);
    } catch {
      toast("Failed to upload image.", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sb-surface-strong mb-10 p-6 md:p-7">
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        <textarea
          name="content"
          placeholder="What are you researching today?"
          className="w-full resize-none border-none bg-transparent p-2 text-lg text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
          rows={3}
          required
          value={draftFields.content}
          onChange={(e) => updateDraftField("content", e.target.value)}
        />

        {imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative group">
                <img
                  src={url}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() =>
                    setImageUrls((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {uploading ? "Uploading..." : "Add Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <SubmitBtnWithAuth
            className="sb-button-accent"
            loadingText={uploading ? "Uploading..." : undefined}
            disabled={uploading}
          >
            Post Update
          </SubmitBtnWithAuth>
        </div>
      </form>
    </div>
  );
}
