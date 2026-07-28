"use client";

import { useEffect, useRef } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';

// This is a dynamic import, so it will only be loaded on the client side.
const ClassicEditor = require('@ckeditor/ckeditor5-build-classic');

interface EditorProps {
  value: string;
  onChange: (data: string) => void;
}

export function Editor({ value, onChange }: EditorProps) {
  const editorRef = useRef<any>(null);

  // This is to prevent the editor from being re-initialized on every render.
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div className="prose max-w-none [&>.ck-editor]:rounded-lg">
      <CKEditor
        editor={ClassicEditor}
        data={value}
        onChange={(event, editor) => {
          const data = editor.getData();
          onChange(data);
        }}
        onReady={(editor) => {
          editorRef.current = editor;
        }}
      />
    </div>
  );
}

export function RichTextDisplay({ html }: { html: string }) {
  return (
    <div
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
