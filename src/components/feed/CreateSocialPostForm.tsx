"use client";

import { Image } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { createSocialPost } from "@/app/actions/feed";
import {
  generateCloudinarySignature,
  deleteFromCloudinary,
} from "@/app/actions/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";

export function CreateSocialPostForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const [draftFields, updateDraftField, resetDraft, isRestored] = useFormDraft(
    "draft_social_post",
    { content: "", imageUrl: "" },
  );

  // Restore image URL from draft once hydration completes
  useEffect(() => {
    if (isRestored && draftFields.imageUrl) {
      setImageUrl(draftFields.imageUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestored, draftFields.imageUrl]);

  // Persist image URL in draft — gated on isRestored so the initial mount
  // does not clobber a restored draft image with the empty initial value.
  useEffect(() => {
    if (!isRestored) return;
    // If the draft has an image but the state hasn't been synced yet, skip
    // this render — the restore effect will set imageUrl and re-run.
    if (draftFields.imageUrl && !imageUrl) return;
    updateDraftField("imageUrl", imageUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, isRestored, draftFields.imageUrl]);

  const { submitting, submit } = useFormSubmit(
    () => {
      resetDraft();
      setImageUrl("");
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
    if (imageUrl) formData.append("imageUrl", imageUrl);
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
      const newUrl = data.secure_url;

      // Replacing an existing image: the previous one is no longer referenced
      // anywhere, so delete it from Cloudinary to avoid orphaned assets.
      if (imageUrl && imageUrl !== newUrl) {
        await deleteFromCloudinary(imageUrl);
      }

      setImageUrl(newUrl);
    } catch {
      toast("Failed to upload image.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!imageUrl) return;

    // Create form: the image isn't referenced anywhere yet, so it's safe to
    // delete immediately when the user removes/replaces it.
    await deleteFromCloudinary(imageUrl);

    setImageUrl("");
    // Clear it from the localStorage draft too (the persist effect's guard
    // prevents it from clearing on its own).
    updateDraftField("imageUrl", "");
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

        {imageUrl && (
          <div className="relative group w-fit">
            <img
              src={imageUrl}
              alt=""
              className="h-20 w-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            />
            {/* Always-visible remove button (works on touch/mobile) */}
            <button
              type="button"
              onClick={handleRemoveImage}
              aria-label="Remove image"
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow-sm hover:bg-red-600"
            >
              ×
            </button>
            {/* Hover overlay: Remove image (desktop) */}
            <div
              onClick={handleRemoveImage}
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <span className="text-xs font-semibold text-white">Remove</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <Image className="h-5 w-5" />
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
