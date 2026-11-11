"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
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
  Plus,
  Loader2,
} from "lucide-react";

import { compressImageToBudget } from "@/utils/image-compression";
import { extractImageUrlsFromHtml } from "@/lib/html";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { useToast } from "@/components/ui/Toast";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  showCharCount?: boolean;
  className?: string;
  scrollable?: boolean;
  onImageUpload?: (formData: FormData) => Promise<string | null>;
}

const Editor = ({
  value,
  onChange,
  maxLength,
  showCharCount = true,
  className,
  scrollable = false,
  onImageUpload,
}: EditorProps) => {
  const { toast } = useToast();
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

  const isEditorDriven = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  // Index of the inline image open in the lightbox, or null.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Every inline image in the document, in order — the lightbox pages through
  // these so a figure can be inspected without leaving the editor.
  const inlineImageUrls = useMemo(
    () => extractImageUrlsFromHtml(value),
    [value],
  );

  const handleImageInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImageUpload || !editor) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    setImageUploading(true);
    try {
      const uploadFile = await compressImageToBudget(file);
      const fd = new FormData();
      fd.append("file", uploadFile);

      const url = await onImageUpload(fd);
      if (url) {
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        toast("Image inserted.", "success");
      }
    } catch (err) {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      const message = err instanceof Error ? err.message : "Failed to insert image.";
      console.error("[Editor Image Insert Error]:", message);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: "sb-editor-image" },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      isEditorDriven.current = true;
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

    if (isEditorDriven.current) {
      isEditorDriven.current = false;
      return;
    }

    const currentHTML = editor.getHTML();
    if (value !== currentHTML) {
      editor.commands.setContent(value);
    }

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
  }, [editor, value]);

  const toggleBold = () => {
    if (!editor) return;
    const newState = !pendingStates.bold;
    editor.chain().focus().toggleBold().run();
    setPendingStates((prev) => ({ ...prev, bold: newState }));
  };

  const toggleItalic = () => {
    if (!editor) return;
    const newState = !pendingStates.italic;
    editor.chain().focus().toggleItalic().run();
    setPendingStates((prev) => ({ ...prev, italic: newState }));
  };

  const toggleStrike = () => {
    if (!editor) return;
    const newState = !pendingStates.strike;
    editor.chain().focus().toggleStrike().run();
    setPendingStates((prev) => ({ ...prev, strike: newState }));
  };

  const toggleHeading = (level: 1 | 2 | 3) => {
    if (!editor) return;
    const key = `heading${level}` as keyof typeof pendingStates;
    const newState = !pendingStates[key];
    editor.chain().focus().toggleHeading({ level }).run();
    setPendingStates((prev) => ({ ...prev, [key]: newState }));
  };

  const toggleBulletList = () => {
    if (!editor) return;
    const newState = !pendingStates.bulletList;
    editor.chain().focus().toggleBulletList().run();
    setPendingStates((prev) => ({ ...prev, bulletList: newState }));
  };

  const toggleOrderedList = () => {
    if (!editor) return;
    const newState = !pendingStates.orderedList;
    editor.chain().focus().toggleOrderedList().run();
    setPendingStates((prev) => ({ ...prev, orderedList: newState }));
  };

  const toggleBlockquote = () => {
    if (!editor) return;
    const newState = !pendingStates.blockquote;
    editor.chain().focus().toggleBlockquote().run();
    setPendingStates((prev) => ({ ...prev, blockquote: newState }));
  };

  const toggleCodeBlock = () => {
    if (!editor) return;
    const newState = !pendingStates.codeBlock;
    editor.chain().focus().toggleCodeBlock().run();
    setPendingStates((prev) => ({ ...prev, codeBlock: newState }));
  };

  const charCount = editor ? editor.getText().length : 0;
  const isOverLimit = maxLength !== undefined && charCount > maxLength;

  if (!editor) {
    return null;
  }

  const isFixedHeight = scrollable || Boolean(className && /h-\[|h-\d|max-h-|h-full|flex-1/.test(className));

  return (
    <div
      className={`sb-editor flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 ${
        isFixedHeight
          ? "h-full min-h-0 flex-col"
          : "min-h-[180px] flex-col"
      } ${className ?? ""}`}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
        <button
          type="button"
          onClick={toggleBold}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.bold
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleItalic}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.italic
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleStrike}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.strike
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button
          type="button"
          onClick={() => toggleHeading(1)}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.heading1
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => toggleHeading(2)}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.heading2
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => toggleHeading(3)}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.heading3
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button
          type="button"
          onClick={toggleBulletList}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.bulletList
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleOrderedList}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.orderedList
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleBlockquote}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.blockquote
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleCodeBlock}
          className={`p-2 rounded-lg transition-all ${
            pendingStates.codeBlock
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label="Code Block"
        >
          <Code className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
          aria-label="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="h-6 border-l border-slate-200 dark:border-slate-800 mx-2" />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={imageUploading}
          className={`p-2 rounded-lg transition-all text-slate-600 dark:text-slate-300 ${imageUploading ? "bg-slate-100 dark:bg-slate-700" : "hover:bg-slate-100 dark:hover:bg-slate-700"}`}
          aria-label="Insert image"
        >
          {imageUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageInsert}
          disabled={imageUploading}
        />
      </div>
      <EditorContent
        editor={editor}
        className={
          isFixedHeight
            ? "min-h-0 flex-1 overflow-y-auto px-5 py-4 [&_.tiptap]:min-h-[120px] [&_.tiptap]:focus:outline-none"
            : "px-5 py-4 [&_.tiptap]:min-h-[120px] [&_.tiptap]:focus:outline-none"
        }
        onClick={(e) => {
          // Clicking an inline image opens the shared lightbox. The editor
          // stays mounted underneath, so the scholar keeps their place.
          const target = e.target as HTMLElement;
          if (target.tagName !== "IMG") return;
          const src = target.getAttribute("src");
          if (!src) return;
          const index = inlineImageUrls.indexOf(src);
          if (index === -1) return;
          e.preventDefault();
          e.stopPropagation();
          setLightboxIndex(index);
        }}
      />
      {lightboxIndex !== null && (
        <ImageLightbox
          images={inlineImageUrls}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(idx) => setLightboxIndex(idx)}
        />
      )}
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
