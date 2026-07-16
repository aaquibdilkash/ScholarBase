import { createHelpPost, updateHelpPost } from "@/app/actions/help";

export type HelpPostFormValues = {
  title: string;
  category: string;
  subject: string;
  message: string;
};

// 👇 1. Removed "use client" so this runs as a Server Component
export default function HelpPostForm({
  mode,
  helpPostId,
  initialValues,
}: {
  mode: "create" | "edit";
  helpPostId?: string;
  initialValues?: Partial<HelpPostFormValues>;
}) {
  const values: HelpPostFormValues = {
    title: initialValues?.title ?? "",
    category: initialValues?.category ?? "",
    subject: initialValues?.subject ?? "",
    message: initialValues?.message ?? "",
  };

  // 👇 2. Define the Server Action cleanly OUTSIDE of the JSX
  async function handleEditAction(formData: FormData) {
    "use server";
    await updateHelpPost(formData, String(helpPostId));
  }

  // 👇 3. Decide which action to use before the return statement
  const formAction = mode === "edit" ? handleEditAction : createHelpPost;

  return (
    <form
      action={formAction}
      className="sb-surface-strong p-8 md:p-10"
    >
      <div className="flex flex-col gap-6">
        <div>
          <label className="sb-label">Title</label>
          <input
            type="text"
            name="title"
            placeholder="Enter a descriptive title"
            className="sb-input"
            required
            defaultValue={values.title}
          />
        </div>

        <div>
          <label className="sb-label">Category</label>
          <select
            name="category"
            className="sb-input"
            required
            defaultValue={values.category}
          >
            <option value="">Select a category</option>
            <option value="Bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="improvement">Site Improvement</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="sb-label">Subject</label>
          <input
            name="subject"
            placeholder="Short summary of your requirement..."
            className="sb-input"
            required
            defaultValue={values.subject}
          />
        </div>

        <div>
          <label className="sb-label">Message</label>
          <textarea
            name="message"
            placeholder="Describe your issue or question in detail."
            className="sb-textarea"
            rows={8}
            required
            defaultValue={values.message}
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className={
              mode === "edit" ? "sb-button-accent" : "sb-button-primary"
            }
          >
            {mode === "edit" ? "Save" : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}