"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
} from "lucide-react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  showCharCount?: boolean;
}

const Editor = ({
  value,
  onChange,
  maxLength,
  showCharCount = true,
}: EditorProps) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => {
      let newContent = editor.getHTML();
      if (maxLength && newContent.length > maxLength) {
        newContent = newContent.slice(0, maxLength);
      }
      onChange(newContent);
    },
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert m-5 focus:outline-none",
      },
    },
    immediatelyRender: true,
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }

    if (value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  const charCount = value.length;

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
      <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex items-center flex-wrap gap-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded-lg ${editor.isActive("bold") ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-lg ${editor.isActive("italic") ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded-lg ${editor.isActive("strike") ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`p-2 rounded-lg ${editor.isActive("heading", { level: 1 }) ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`p-2 rounded-lg ${editor.isActive("heading", { level: 2 }) ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`p-2 rounded-lg ${editor.isActive("heading", { level: 3 }) ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded-lg ${editor.isActive("bulletList") ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded-lg ${editor.isActive("orderedList") ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded-lg ${editor.isActive("blockquote") ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded-lg ${editor.isActive("codeBlock") ? "bg-slate-200 dark:bg-slate-800" : ""}`}
          aria-label="Code Block"
        >
          <Code className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-2 rounded-lg"
          aria-label="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <EditorContent editor={editor} />
      {showCharCount && (
        <div className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
          {String(charCount).replace(/(\d+)(?=.(\d{3})*$)/g, "$1,")}
          {maxLength ? `/${maxLength}` : ""} characters
        </div>
      )}
    </div>
  );
};

export { Editor };
