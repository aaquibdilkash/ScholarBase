"use client";

import { Image as ImageIcon } from "lucide-react";
import NextImage from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { createSocialPost } from "@/app/actions/feed";
import {
  generateCloudinarySignature,
  deleteFromCloudinary,
} from "@/app/actions/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { MentionComposer, type MentionUser } from "@/components/interactions/MentionComposer";
import type { SocialPostWithAuthor } from "@/types/cards";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { FEED_CONTENT_TIP, FEED_IMAGE_TIP } from "@/constants/tooltips";
import { MAX_SOCIAL_POST_CONTENT } from "@/lib/constants";

export function CreateSocialPostForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);

  const [draftFields, updateDraftField, resetDraft, isRestored] = useFormDraft(
    "draft_social_post",
    { content: "", imageUrl: "" },
  );

  // Restore image URL from draft once hydration completes
  useEffect(() => {
    if (isRestored && draftFields.imageUrl) {
      setImageUrl(draftFields.imageUrl);
    }
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

  // Save mentions to draft separately (useFormDraft only handles content and imageUrl)
  const draftMentionsKey = "draft_social_post_mentions";
  useEffect(() => {
    if (!isRestored) return;
    try {
      const saved = localStorage.getItem(draftMentionsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMentionedUsers(parsed);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [isRestored]);

  // Persist mentions to draft
  useEffect(() => {
    if (!isRestored) return;
    try {
      localStorage.setItem(draftMentionsKey, JSON.stringify(mentionedUsers));
    } catch {
      // ignore storage errors
    }
  }, [mentionedUsers, isRestored]);

  const handleSubmit = async (formData: FormData) => {
    if (uploading) {
      toast("Please wait for images to finish uploading.", "error");
      return;
    }
    if (imageUrl) formData.append("imageUrl", imageUrl);
    formData.append(
      "mentions",
      JSON.stringify(mentionedUsers.map((u) => ({ id: u.id, handle: u.handle }))),
    );
    setSubmitting(true);
    try {
      const response = await createSocialPost(formData);
      if (!response?.success || !response.data) {
        toast("Failed to create post.", "error");
        return;
      }
      queryClient.setQueriesData<SocialPostWithAuthor[]>(
        { queryKey: ["feed"] },
        (oldData = []) => [response.data, ...oldData],
      );
      resetDraft();
      setImageUrl("");
      setMentionedUsers([]);
      localStorage.removeItem(draftMentionsKey);
      formRef.current?.reset();
      toast("Post published successfully!", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create post.";
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
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
        <MentionComposer
          name="content"
          value={draftFields.content}
          onChange={(val) => updateDraftField("content", val)}
          placeholder="What are you researching today? Type @ to mention a scholar"
          mentionedUsers={mentionedUsers}
          onMentionedUsersChange={setMentionedUsers}
          label="Post Content"
          tooltip={FEED_CONTENT_TIP}
          maxLength={MAX_SOCIAL_POST_CONTENT}
          showPreview={true}
        />

        {imageUrl && (
          <div className="relative group w-fit">
            <NextImage
              src={imageUrl}
              alt=""
              width={80}
              height={80}
              unoptimized
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
            <ImageIcon className="h-5 w-5" aria-hidden="true" />
            {uploading ? "Uploading..." : "Add Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <InfoTooltip message={FEED_IMAGE_TIP} />
          </label>
          <SubmitBtnWithAuth
            className="sb-button-accent"
            loadingText={uploading ? "Uploading..." : undefined}
            disabled={uploading || submitting}
          >
            Post Update
          </SubmitBtnWithAuth>
        </div>
      </form>
    </div>
  );
}
