"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { deleteSocialPost, updateSocialPost } from "@/app/actions/feed";
import { useToast } from "@/components/ui/Toast";

export function PostActions({
  postId,
  content,
}: {
  postId: string;
  content: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteSocialPost(postId);
        toast("Post deleted.", "success");
      } catch {
        toast("Failed to delete post. Please try again.", "error");
      }
    });
  };

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      try {
        await updateSocialPost(formData, postId);
        toast("Post updated!", "success");
      } catch {
        toast("Failed to update post. Please try again.", "error");
      }
    });
  };

  return (
    <div className="mt-4 flex justify-end">
      <div className="flex flex-col items-end gap-2 min-w-[220px]">
        <form className="flex flex-col items-end gap-2" action={handleUpdate}>
          <textarea
            name="content"
            defaultValue={content}
            required
            rows={1}
            className="hidden"
          />
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="animate-spin h-3 w-3" />
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </button>
        </form>

        <form action={handleDelete}>
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="animate-spin h-3 w-3" />
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
