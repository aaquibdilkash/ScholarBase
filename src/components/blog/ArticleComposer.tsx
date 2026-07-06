"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import Placeholder from "@tiptap/extension-placeholder";
import { RichContent } from "@/components/content/RichContent";

type ArticleComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
};

function ToolbarButton({
  active,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
      }`}
    >
      {label}
    </button>
  );
}

export function ArticleComposer({ action }: ArticleComposerProps) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");

  const liveContent =
    content || "<p>Start writing to see the live article preview.</p>";

  const editor = useEditor({
    extensions: [
      StarterKit,
      Superscript,
      Subscript,
      Placeholder.configure({
        placeholder:
          "Write your article here. Use the toolbar for formatting like a document editor.",
      }),
    ],
    content: "",
    onUpdate: ({ editor: currentEditor }) => {
      setContent(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[26rem] rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-slate-800 outline-none prose prose-slate max-w-none focus:border-blue-300",
      },
    },
    immediatelyRender: false,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
      <form action={action} className="flex flex-col gap-6">
        <div>
          <label className="sb-label">Article Title</label>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g., The Ultimate PhD Survival Guide"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Short Description</label>
          <input
            name="excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="A brief summary of your article..."
            className="sb-input"
            required
          />
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="sb-label mb-0">Content</label>
            <div className="flex flex-wrap gap-2">
              <ToolbarButton
                label="Bold"
                active={editor?.isActive("bold")}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              />
              <ToolbarButton
                label="Italic"
                active={editor?.isActive("italic")}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              />
              <ToolbarButton
                label="Sup"
                active={editor?.isActive("superscript")}
                onClick={() =>
                  editor?.chain().focus().toggleSuperscript().run()
                }
              />
              <ToolbarButton
                label="Sub"
                active={editor?.isActive("subscript")}
                onClick={() => editor?.chain().focus().toggleSubscript().run()}
              />
              <ToolbarButton
                label="H2"
                active={editor?.isActive("heading", { level: 2 })}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
              />
              <ToolbarButton
                label="List"
                active={editor?.isActive("bulletList")}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              />
              <ToolbarButton
                label="Quote"
                active={editor?.isActive("blockquote")}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              />
            </div>
          </div>

          <input
            type="hidden"
            name="content"
            value={editor?.getHTML() ?? content}
          />

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <EditorContent editor={editor} />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            This is a lightweight rich-text editor with live preview. It stays
            fast while giving you document-style formatting.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button type="submit" className="sb-button-accent">
            Publish Article
          </button>
        </div>
      </form>

      <section className="sb-surface-strong overflow-hidden border border-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Live Preview
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {title || "Your article"}
            </h2>
          </div>
          <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Draft
          </div>
        </div>

        <div className="space-y-5 p-6">
          <p className="text-sm leading-relaxed text-slate-600">
            {excerpt || "Your short description will appear here."}
          </p>

          <div className="prose prose-slate max-w-none prose-headings:text-slate-950 prose-a:text-blue-700 hover:prose-a:text-blue-600">
            <RichContent content={liveContent} />
          </div>
        </div>
      </section>
    </div>
  );
}
