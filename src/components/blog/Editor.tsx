"use client";

import { Editor } from "@/components/ui/Editor";

type EditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function BlogEditor({ value, onChange }: EditorProps) {
  return <Editor value={value} onChange={onChange} />;
}
