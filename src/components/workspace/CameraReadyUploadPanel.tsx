"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { createManuscriptUploadUrlAction, submitCameraReadyAction } from "@/app/actions/manuscripts";
import { MANUSCRIPT_BUCKET, MANUSCRIPT_DOCX_MIME, MANUSCRIPT_PDF_MIME, MAX_MANUSCRIPT_BYTES, MAX_MANUSCRIPT_SOURCE_BYTES, isPdfUpload } from "@/lib/publishing/constants";
import { createClient } from "@/utils/supabase/client";

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function CameraReadyUploadPanel({ manuscriptId }: { manuscriptId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (!file || !sourceFile) return setMessage("Choose both the final PDF and the DOCX production source.");
    if (!isPdfUpload(file) || file.size <= 0 || file.size > MAX_MANUSCRIPT_BYTES) return setMessage("Choose a PDF smaller than 25 MB.");
    if (!sourceFile.name.toLowerCase().endsWith(".docx") || (sourceFile.type && sourceFile.type !== MANUSCRIPT_DOCX_MIME) || sourceFile.size <= 0 || sourceFile.size > MAX_MANUSCRIPT_SOURCE_BYTES) return setMessage("Choose a DOCX source smaller than 25 MB.");
    setBusy(true);
    setMessage("");
    try {
      const [ticket, sourceTicket] = await Promise.all([createManuscriptUploadUrlAction(), createManuscriptUploadUrlAction("DOCX")]);
      if (!ticket.success) return setMessage(ticket.message);
      if (!sourceTicket.success) return setMessage(sourceTicket.message);
      const [hash, sourceHash] = await Promise.all([sha256File(file), sha256File(sourceFile)]);
      const storage = createClient();
      const body = file.type === MANUSCRIPT_PDF_MIME ? file : new Blob([file], { type: MANUSCRIPT_PDF_MIME });
      const uploaded = await storage.storage.from(MANUSCRIPT_BUCKET).uploadToSignedUrl(ticket.data.path, ticket.data.token, body);
      if (uploaded.error) return setMessage("The PDF upload failed. Please try again.");
      const sourceUploaded = await storage.storage.from(MANUSCRIPT_BUCKET).uploadToSignedUrl(sourceTicket.data.path, sourceTicket.data.token, sourceFile);
      if (sourceUploaded.error) return setMessage("The DOCX source upload failed. Please try again.");
      const formData = new FormData();
      formData.set("manuscriptId", manuscriptId);
      formData.set("filePath", ticket.data.path);
      formData.set("fileName", file.name);
      formData.set("fileSize", String(file.size));
      formData.set("sha256", hash);
      formData.set("sourceDocxPath", sourceTicket.data.path);
      formData.set("sourceDocxName", sourceFile.name);
      formData.set("sourceDocxSize", String(sourceFile.size));
      formData.set("sourceDocxSha256", sourceHash);
      const result = await submitCameraReadyAction({ success: false, message: "" }, formData);
      setMessage(result.message);
      if (result.success) { setFile(null); setSourceFile(null); }
    } catch {
      setMessage("The camera-ready upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="sb-card"><h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Production package</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Upload the final non-anonymous PDF and its DOCX source. The reviewed submission remains preserved.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Final PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={busy} className="mt-1 block max-w-full text-sm" /></label><label className="text-sm font-medium">DOCX source<input type="file" accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" onChange={(event) => setSourceFile(event.target.files?.[0] ?? null)} disabled={busy} className="mt-1 block max-w-full text-sm" /></label></div><button type="button" onClick={submit} disabled={busy} className="sb-button-primary mt-4 inline-flex items-center gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {busy ? "Uploading…" : "Upload production package"}</button>{message ? <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}</section>;
}
