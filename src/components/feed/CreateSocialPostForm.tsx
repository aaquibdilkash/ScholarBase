"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { createSocialPost } from "@/app/actions/feed";
import { useToast } from "@/components/ui/Toast";
import { ImageUploadField } from "@/components/upload/ImageUploadField";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { MentionComposer, type MentionUser } from "@/components/interactions/MentionComposer";
import type { SocialPostWithAuthor } from "@/types/cards";
import { FEED_CONTENT_TIP, FEED_IMAGE_TIP } from "@/constants/tooltips";
import { MAX_SOCIAL_POST_CONTENT } from "@/lib/constants";
import { useIsFrozen } from "@/components/interactions/FrozenUserProvider";

export function CreateSocialPostForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Frozen accounts are blocked from posting — proactively hide the composer
  // instead of letting the user hit a rejected server action.
  const isFrozen = useIsFrozen();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageBusy, setImageBusy] = useState(false);
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
    if (isFrozen) {
      toast("Your account is frozen. Posting is disabled.", "error");
      return;
    }
    if (imageBusy) {
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
        // Backend may have rejected the action (e.g. frozen account or rate
        // limit) — surface the exact reason instead of a generic fallback.
        const reason =
          response && "message" in response
            ? (response as { message?: string }).message
            : response && "error" in response
              ? (response as { error?: string }).error
              : "";
        toast(reason || "Failed to create post.", "error");
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


  return (
    <div className="sb-surface-strong mb-10 p-6 md:p-7">
      {isFrozen ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
        >
          <span aria-hidden>❄</span>
          Your account is frozen. Posting is disabled until a moderator reviews
          your account.
        </p>
      ) : (
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


        <ImageUploadField
          kind="social"
          value={imageUrl}
          onChange={setImageUrl}
          onUploadingChange={setImageBusy}
          buttonLabel="Add Image"
          tooltip={FEED_IMAGE_TIP}
          hint="Large images are auto-compressed under 500 KB."
          className="w-fit"
        />

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <SubmitBtnWithAuth
            className="sb-button-accent"
            loadingText={imageBusy ? "Uploading..." : undefined}
            disabled={imageBusy || submitting}
          >
            Post Update
          </SubmitBtnWithAuth>
        </div>
      </form>
      )}
    </div>
  );
}
