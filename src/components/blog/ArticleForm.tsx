import { createArticle, updateArticle } from "@/app/actions/blog";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export type ArticleFormValues = {
  title: string;
  content: string;
  excerpt: string;
};

// 👇 1. Removed "use client" so this can run smoothly as a Server Component
export default function ArticleForm({
  mode,
  articleId,
  initialValues,
}: {
  mode: "create" | "edit";
  articleId?: string;
  initialValues?: Partial<ArticleFormValues>;
}) {
  const values: ArticleFormValues = {
    title: initialValues?.title ?? "",
    content: initialValues?.content ?? "",
    excerpt: initialValues?.excerpt ?? "",
  };

  // 👇 2. Define the Server Action cleanly OUTSIDE of the JSX
  async function handleEditAction(formData: FormData) {
    "use server";
    await updateArticle(formData, String(articleId), "");
  }

  // 👇 3. Decide which action to use before the return statement
  const formAction = mode === "edit" ? handleEditAction : createArticle;

  return (
    <form
      action={formAction}
      className="sb-surface-strong flex flex-col gap-6 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Title</label>
        <input
          name="title"
          placeholder="Enter article title"
          className="sb-input"
          required
          defaultValue={values.title}
        />
      </div>

      <div>
        <label className="sb-label">Excerpt</label>
        <textarea
          name="excerpt"
          placeholder="Short summary"
          className="sb-input h-24"
          defaultValue={values.excerpt}
        />
      </div>

      <div>
        <label className="sb-label">Content</label>
        <textarea
          name="content"
          placeholder="Write your content"
          className="sb-input h-64"
          required
          defaultValue={values.content}
        />
      </div>

      <SubmitBtn className="sb-button-accent">
        {mode === "edit" ? "Save Changes" : "Publish Article"}
      </SubmitBtn>
    </form>
  );
}
