"use client";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditorBuild from "@ckeditor/ckeditor5-build-classic";
import type { ComponentProps } from "react";

const ClassicEditor = ClassicEditorBuild as unknown as ComponentProps<
  typeof CKEditor
>["editor"];

type EditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function Editor({ value, onChange }: EditorProps) {
  return (
    <CKEditor
      editor={ClassicEditor}
      config={{
        licenseKey: "GPL",
        toolbar: [
          "heading",
          "|",
          "bold",
          "italic",
          "link",
          "bulletedList",
          "numberedList",
          "blockQuote",
          "undo",
          "redo",
        ],
        heading: {
          options: [
            {
              model: "paragraph",
              title: "Paragraph",
              class: "ck-heading_paragraph",
            },
            {
              model: "heading1",
              view: "h1",
              title: "Heading 1",
              class: "ck-heading_heading1",
            },
            {
              model: "heading2",
              view: "h2",
              title: "Heading 2",
              class: "ck-heading_heading2",
            },
            {
              model: "heading3",
              view: "h3",
              title: "Heading 3",
              class: "ck-heading_heading3",
            },
          ],
        },
      }}
      data={value}
      onChange={(_, editor) => {
        onChange(editor.getData());
      }}
    />
  );
}
