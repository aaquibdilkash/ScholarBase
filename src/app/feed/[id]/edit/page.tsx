import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { getPostEditData } from "@/app/actions/feed";
import PostEditForm from "@/components/feed/PostEditForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";
import type { MentionUser } from "@/components/interactions/MentionComposer";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireCurrentUser("Log in to edit this post.");

  let post;
  try {
    post = await getPostEditData(id);
  } catch {
    notFound();
  }

  return (
    <CreateOrEditPageShell
      title={EDIT_PAGE_TEXT.feed.title}
      description={EDIT_PAGE_TEXT.feed.description}
      backHref={`/feed/${id}`}
      backLabel="Cancel and Back to Post"
      maxWidth="lg"
    >
      <PostEditForm
        postId={id}
        initialValues={{
          content: post.content,
          imageUrl: post.imageUrl ?? "",
          mentions: Array.isArray(post.mentions) ? (post.mentions as MentionUser[]) : null,
        }}
      />
    </CreateOrEditPageShell>
  );
}
