// src/lib/shield/document-parser.ts
// 100% client-side document parsing — file bytes never leave the browser.
// PDF via unpdf (PDF.js, no worker config), DOCX via mammoth, TXT/MD direct.
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export interface ParsedDocument {
  text: string;
  filename: string;
  title: string;
  pageCount?: number;
  wordCount: number;
}

/** Derive a clean manuscript title from filename. */
function cleanTitleFromFilename(name: string): string {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(draft|v\d+|final|copy|turnitin|report)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function parseDocumentClientSide(file: File): Promise<ParsedDocument> {
  const filename = file.name;
  const title = cleanTitleFromFilename(filename) || "Academic Manuscript";
  const extension = filename.split(".").pop()?.toLowerCase();

  let rawText = "";
  let pageCount: number | undefined;

  if (extension === "pdf") {
    const buffer = await file.arrayBuffer();
    const pdfProxy = await getDocumentProxy(new Uint8Array(buffer));
    pageCount = pdfProxy.numPages;
    const extracted = await extractText(pdfProxy, { mergePages: true });
    rawText = typeof extracted.text === "string" ? extracted.text : "";
  } else if (extension === "docx") {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    rawText = result.value;
  } else if (extension === "txt" || extension === "md") {
    rawText = await file.text();
  } else if (extension === "doc") {
    throw new Error(
      "Legacy .doc is not supported for private in-browser parsing. Please save as .docx or .pdf and re-upload.",
    );
  } else {
    throw new Error(
      `Unsupported file type: .${extension}. Please upload a .pdf, .docx, or .txt file.`,
    );
  }

  const cleanedText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleanedText) {
    throw new Error(
      "Could not extract readable text. It might be a scanned image-only PDF.",
    );
  }

  return {
    text: cleanedText,
    filename,
    title,
    pageCount,
    wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
  };
}
