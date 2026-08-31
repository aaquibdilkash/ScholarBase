"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { updateSocialPost, getPostEditData } from "@/app/actions/feed";
import type { SocialPostWithAuthor } from "@/types/cards";
import { generateCloudinarySignature } from "@/app/actions/cloudinary";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { MentionComposer, type MentionUser } from "@/components/interactions/MentionComposer";
import { FEED_CONTENT_TIP, FEED_IMAGE_TIP } from "@/constants/tooltips";
import { MAX_SOCIAL_POST_CONTENT } from "@/lib/constants";

export default function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [postId, setPostId] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const { id } = await params;
      setPostId(id);

      try {
        const data = await getPostEditData(id);
        setContent(data.content || "");
        setImageUrl(data.imageUrl || "");
        // Restore mentions from JSON data
        if (data.mentions && Array.isArray(data.mentions)) {
          setMentionedUsers(data.mentions as MentionUser[]);
        }
      } catch (error) {
        toast((error as Error).message || "Failed to load post.", "error");
        router.push("/feed");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [params, router, toast]);

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
      setImageUrl(data.secure_url);
    } catch {
      toast("Failed to upload image.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId) return;

    if (uploading) {
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
      toast(
        err instanceof Error ? err.message : "Failed to update post.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        </div>
      </main>
    );
  }

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
        className="sb-surface-strong p-6 md:p-8 flex flex-col gap-4"
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

        {/* Image */}
        {imageUrl && (
          <div>
            <label className="sb-label mb-2 block">Current Image</label>
            <div className="flex">
              <div className="relative group">
                <Image
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
                  onClick={() => setImageUrl("")}
                  aria-label="Remove image"
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow-sm hover:bg-red-600"
                >
                  ×
                </button>
                {/* Hover overlay: Remove image. The image is only deleted from
                    Cloudinary server-side after a successful save. */}
                <div
                  onClick={() => setImageUrl("")}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <span className="text-xs font-semibold text-white">
                    Remove
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            <ImageIcon className="h-5 w-5" />
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
          <div className="flex justify-end gap-3">
            <FormCancelButton />
            <button
              type="submit"
              disabled={submitting || uploading}
              className="sb-button-accent"
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
