"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateSocialPost, getPostEditData } from "@/app/actions/feed";
import type { SocialPostWithAuthor } from "@/types/cards";
import { Loader2 } from "lucide-react";
import { ImageUploadField } from "@/components/upload/ImageUploadField";
import { useToast } from "@/components/ui/Toast";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { MentionComposer, type MentionUser } from "@/components/interactions/MentionComposer";
import { FEED_CONTENT_TIP, FEED_IMAGE_TIP } from "@/constants/tooltips";
import { MAX_SOCIAL_POST_CONTENT } from "@/lib/constants";

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch the post via React Query instead of a manual useEffect + loading
  // flag. React Query dedupes concurrent / StrictMode mount invokes, so the
  // server action runs exactly once even in dev (previously StrictMode fired
  // it twice), and the cached result is reused when navigating back into the
  // page. (Previously three "post detail" requests appeared because the source
  // /feed/[id] page also calls the heavy cached getPost in both
  // generateMetadata and the page component while this page re-fetched.)
  const {
    data: postData,
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: ["postEdit", id],
    queryFn: () => getPostEditData(id as string),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (isError) {
      toast("Failed to load post.", "error");
      router.push("/feed");
    }
  }, [isError, router, toast]);

  useEffect(() => {
    if (postData) {
      setContent(postData.content || "");
      setImageUrl(postData.imageUrl || "");
      if (postData.mentions && Array.isArray(postData.mentions)) {
        setMentionedUsers(postData.mentions as MentionUser[]);
      }
    }
  }, [postData]);

  if (!id) return null;
  if (isError) return null;


  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-2 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

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
        JSON.stringify(mentionedUsers.map((u) => ({ id: u.id, handle: u.handle }))),
      );

      const result = await updateSocialPost(formData, id);
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
      toast(
        err instanceof Error ? err.message : "Failed to update post.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CreateOrEditPageShell
      title="Edit Post"
      description="Edit your social post."
      backHref={`/feed`}
      backLabel="← Back to Feed"
      maxWidth="lg"
    >
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
    </CreateOrEditPageShell>
  );
}
