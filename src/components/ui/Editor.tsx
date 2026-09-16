"use client";

import { useEffect, useState } from "react";
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
  /** Extra classes for the outer shell. Pass e.g. `h-[420px] lg:h-[520px]`
      when the parent wants the editor pinned to a fixed height; by default
      the editor grows naturally with its content (other forms rely on this). */
  className?: string;
}

const Editor = ({
  value,
  onChange,
  maxLength,
  showCharCount = true,
  className,
}: EditorProps) => {
  const [pendingStates, setPendingStates] = useState({
    bold: false,
    italic: false,
    strike: false,
    heading1: false,
    heading2: false,
    heading3: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-slate dark:prose-invert prose-sm sm:prose-base max-w-none min-h-[120px] focus:outline-none prose-ol:list-decimal prose-ul:list-disc prose-headings:font-bold",
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
      
      const text = editor.getText();
      if (text.length > 0) {
        setPendingStates({
          bold: editor.isActive("bold"),
          italic: editor.isActive("italic"),
          strike: editor.isActive("strike"),
          heading1: editor.isActive("heading", { level: 1 }),
          heading2: editor.isActive("heading", { level: 2 }),
          heading3: editor.isActive("heading", { level: 3 }),
          bulletList: editor.isActive("bulletList"),
          orderedList: editor.isActive("orderedList"),
          blockquote: editor.isActive("blockquote"),
          codeBlock: editor.isActive("codeBlock"),
        });
      }
    }
  }, [editor, value]);

  const toggleFormat = (key: keyof typeof pendingStates) => {
    if (!editor) return;
    
    setPendingStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    
    const command = key === "bold"
      ? () => editor.chain().focus().toggleBold().run()
      : key === "italic"
      ? () => editor.chain().focus().toggleItalic().run()
      : key === "strike"
      ? () => editor.chain().focus().toggleStrike().run()
      : key === "heading1"
      ? () => editor.chain().focus().toggleHeading({ level: 1 }).run()
      : key === "heading2"
      ? () => editor.chain().focus().toggleHeading({ level: 2 }).run()
      : key === "heading3"
      ? () => editor.chain().focus().toggleHeading({ level: 3 }).run()
      : key === "bulletList"
      ? () => editor.chain().focus().toggleBulletList().run()
      : key === "orderedList"
      ? () => editor.chain().focus().toggleOrderedList().run()
      : key === "blockquote"
      ? () => editor.chain().focus().toggleBlockquote().run()
      : () => editor.chain().focus().toggleCodeBlock().run();
    
    command();
  };

  const charCount = editor ? editor.getText().length : 0;
  const isOverLimit = Boolean(maxLength) && charCount > (maxLength ?? 0);

  if (!editor) {
    return null;
  }

  const isFixedHeight = Boolean(className && /h-\[|h-\d|max-h-|h-full|flex-1/.test(className));

  return (
    <div
      className={`flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 ${
        isFixedHeight
          ? "h-full min-h-0 flex-col"
          : "min-h-[180px] flex-col"
      } ${className ?? ""}`}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
        <button type="button"
          onClick={() => toggleFormat("bold")}
          className={`p-2 rounded-lg transition-all ${pendingStates.bold ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button type="button"
          onClick={() => toggleFormat("italic")}
          className={`p-2 rounded-lg transition-all ${pendingStates.italic ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button type="button"
          onClick={() => toggleFormat("strike")}
          className={`p-2 rounded-lg transition-all ${pendingStates.strike ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button type="button"
          onClick={() => toggleFormat("heading1")}
          className={`p-2 rounded-lg transition-all ${pendingStates.heading1 ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button type="button"
          onClick={() => toggleFormat("heading2")}
          className={`p-2 rounded-lg transition-all ${pendingStates.heading2 ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button"
          onClick={() => toggleFormat("heading3")}
          className={`p-2 rounded-lg transition-all ${pendingStates.heading3 ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button type="button"
          onClick={() => toggleFormat("bulletList")}
          className={`p-2 rounded-lg transition-all ${pendingStates.bulletList ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button type="button"
          onClick={() => toggleFormat("orderedList")}
          className={`p-2 rounded-lg transition-all ${pendingStates.orderedList ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button type="button"
          onClick={() => toggleFormat("blockquote")}
          className={`p-2 rounded-lg transition-all ${pendingStates.blockquote ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </button>
        <button type="button"
          onClick={() => toggleFormat("codeBlock")}
          className={`p-2 rounded-lg transition-all ${pendingStates.codeBlock ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
          aria-label="Code Block"
        >
          <Code className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
          aria-label="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <EditorContent
        editor={editor}
        className={
          isFixedHeight
            ? "min-h-0 flex-1 overflow-y-auto px-5 py-4 [&_.tiptap]:min-h-[120px] [&_.tiptap]:focus:outline-none"
            : "px-5 py-4 [&_.tiptap]:min-h-[120px] [&_.tiptap]:focus:outline-none"
        }
      />
      {showCharCount && (
        <div
          className={`shrink-0 border-t border-slate-200 px-2 py-1 text-xs dark:border-slate-800 ${
            isOverLimit
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
          }`}
        >
          {charCount.toLocaleString("en-US")}
          {maxLength ? `/${maxLength}` : ""} characters
          {isOverLimit ? " — over the limit" : ""}
        </div>
      )}
    </div>
  );
};

export { Editor };