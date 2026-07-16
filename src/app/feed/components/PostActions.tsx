"use client";

import { useTransition } from "react";
import { deleteSocialPost, updateSocialPost } from "@/app/actions/feed";

export function PostActions({
  postId,
  content,
}: {
  postId: string;
  content: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteSocialPost(postId);
    });
  };

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      await updateSocialPost(formData, postId);
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
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </form>

        <form action={handleDelete}>
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
          >
            {isPending ? "Deleting..." : "Delete"}
          </button>
        </form>
      </div>
    </div>
  );
}
