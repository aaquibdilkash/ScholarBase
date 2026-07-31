"use client";

import React, { useEffect, useRef, useState } from "react";

interface EditorProps {
  value: string;
  onChange: (data: string) => void;
}

export function Editor({ value, onChange }: EditorProps) {
  const editorRef = useRef<any>(null);
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [ckEditorModules, setCkEditorModules] = useState<any>(null);

  useEffect(() => {
    setCkEditorModules({
      CKEditor: require('@ckeditor/ckeditor5-react').CKEditor,
      ClassicEditor: require('@ckeditor/ckeditor5-build-classic')
    });
    setEditorLoaded(true);
  }, []);

  if (!editorLoaded || !ckEditorModules) {
    return <div>Loading editor...</div>;
  }

  const { CKEditor, ClassicEditor } = ckEditorModules;

  return (
    <div className="prose max-w-none [&>.ck-editor]:rounded-lg">
      <CKEditor
        editor={ClassicEditor}
        data={value}
        onChange={(event: any, editor: any) => {
          const data = editor.getData();
          onChange(data);
        }}
        onReady={(editor: any) => {
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
