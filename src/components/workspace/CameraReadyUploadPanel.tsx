"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { createManuscriptUploadUrlAction, submitCameraReadyAction } from "@/app/actions/manuscripts";
import { MANUSCRIPT_BUCKET, MANUSCRIPT_PDF_MIME, MAX_MANUSCRIPT_BYTES, isPdfUpload } from "@/lib/publishing/constants";
import { createClient } from "@/utils/supabase/client";

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function CameraReadyUploadPanel({ manuscriptId }: { manuscriptId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (!file) return setMessage("Choose the final camera-ready PDF first.");
    if (!isPdfUpload(file) || file.size <= 0 || file.size > MAX_MANUSCRIPT_BYTES) return setMessage("Choose a PDF smaller than 25 MB.");
    setBusy(true);
    setMessage("");
    try {
      const ticket = await createManuscriptUploadUrlAction();
      if (!ticket.success) return setMessage(ticket.message);
      const hash = await sha256File(file);
      const storage = createClient();
      const body = file.type === MANUSCRIPT_PDF_MIME ? file : new Blob([file], { type: MANUSCRIPT_PDF_MIME });
      const uploaded = await storage.storage.from(MANUSCRIPT_BUCKET).uploadToSignedUrl(ticket.data.path, ticket.data.token, body);
      if (uploaded.error) return setMessage("The PDF upload failed. Please try again.");
      const formData = new FormData();
      formData.set("manuscriptId", manuscriptId);
      formData.set("filePath", ticket.data.path);
      formData.set("fileName", file.name);
      formData.set("fileSize", String(file.size));
      formData.set("sha256", hash);
      const result = await submitCameraReadyAction({ success: false, message: "" }, formData);
      setMessage(result.message);
      if (result.success) setFile(null);
    } catch {
      setMessage("The camera-ready upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="sb-card"><h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Camera-ready PDF</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Upload the final version for production. The original reviewed file remains preserved.</p><div className="mt-3 flex flex-wrap items-center gap-3"><input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={busy} className="block max-w-full text-sm" /><button type="button" onClick={submit} disabled={busy} className="sb-button-primary inline-flex items-center gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {busy ? "Uploading…" : "Upload final PDF"}</button></div>{message ? <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}</section>;
}
