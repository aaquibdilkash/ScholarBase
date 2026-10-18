"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { updateSocialPost } from "@/app/actions/feed";
import { MentionComposer, type MentionUser } from "@/components/interactions/MentionComposer";
import { ImageUploadField } from "@/components/upload/ImageUploadField";
import { useToast } from "@/components/ui/Toast";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { Loader2 } from "lucide-react";
import { FEED_CONTENT_TIP, FEED_IMAGE_TIP } from "@/constants/tooltips";
import { MAX_SOCIAL_POST_CONTENT } from "@/lib/constants";
import type { SocialPostWithAuthor } from "@/types/cards";

type PostEditFormProps = {
  postId: string;
  initialValues: {
    content: string;
    imageUrl: string;
    mentions: MentionUser[] | null;
  };
};

export default function PostEditForm({ postId, initialValues }: PostEditFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState(initialValues.content);
  const [imageUrl, setImageUrl] = useState(initialValues.imageUrl);
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>(initialValues.mentions ?? []);
  const [imageBusy, setImageBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId) return;

    if (imageBusy) {
      toast("Please wait for images to finish uploading.", "error");
      return;
    }

    if (!content.trim()) {
      toast("Post content cannot be empty.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("content", content);
      if (imageUrl) formData.append("imageUrl", imageUrl);
      formData.append(
        "mentions",
        JSON.stringify(
          mentionedUsers.map((u) => ({ id: u.id, handle: u.handle })),
        ),
      );

      const result = await updateSocialPost(formData, postId);
      if (result.success && result.data) {
        queryClient.setQueriesData(
          { queryKey: ["feed"] },
          (oldData: SocialPostWithAuthor[] = []) =>
            oldData.map((p) => (p.id === result.data!.id ? result.data : p)),
        );
        toast("Post updated successfully!", "success");

        router.push(`/feed/${result.data.id}`);
      } else {
        toast((result && result.message) || "Failed to update post.", "error");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update post.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="sb-surface-strong flex flex-col gap-4 p-4 sm:p-6 md:p-8"
    >
      <MentionComposer
        name="content"
        value={content}
        onChange={setContent}
        placeholder="What's on your mind? Type @ to mention a scholar"
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
        allowFrozen
        buttonLabel="Add Image"
        tooltip={FEED_IMAGE_TIP}
        hint="Removing the image keeps the post text; the old image is deleted when you save."
      />

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full gap-3 sm:w-auto">
          <FormCancelButton className="flex-1 sm:flex-initial" />
          <button
            type="submit"
            disabled={submitting || imageBusy}
            className="sb-button-accent flex-1 sm:flex-initial"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin h-4 w-4" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
