import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  MANUSCRIPT_BUCKET,
  MANUSCRIPT_PDF_MIME,
  MAX_MANUSCRIPT_BYTES,
} from "@/lib/publishing/constants";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * Private manuscript storage.
 *
 * PDFs never travel through a Server Action: `next.config.ts` caps those at
 * 6 MB, and buffering a 25 MB paper through a 2-core box is the wrong trade.
 * The browser asks for a short-lived signed upload ticket, uploads directly to
 * Supabase, then submits the path and digest. The server re-reads the object
 * with the service role and refuses it unless the size, MIME, and SHA-256 all
 * match — the signed ticket authorises the write, not the claim about it.
 *
 * Paths are server-issued and user-scoped. A caller can never name a path
 * outside `users/<their id>/manuscripts/`, so one author cannot overwrite (or
 * later reference) another author's file.
 */

const MANUSCRIPT_PATH_PATTERN =
  /^users\/([A-Za-z0-9_-]+)\/manuscripts\/([A-Za-z0-9-]+)\.pdf$/;

export function manuscriptObjectPath(userId: string, objectId: string): string {
  return `users/${userId}/manuscripts/${objectId}.pdf`;
}

export function isManuscriptObjectPathForUser(
  userId: string,
  path: string,
): boolean {
  const match = MANUSCRIPT_PATH_PATTERN.exec(path);
  return Boolean(match && match[1] === userId);
}

export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** A digest is only useful if it is exactly 64 lower-case hex characters. */
export function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export type ManuscriptUploadTicket = {
  path: string;
  /** Token for `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`. */
  token: string;
};

/**
 * Issues a one-object upload ticket. Returns `null` when the bucket is missing
 * or the service role is not configured, so the action can show one honest
 * message instead of a stack trace.
 */
export async function createManuscriptUploadTicket(
  userId: string,
): Promise<ManuscriptUploadTicket | null> {
  const path = manuscriptObjectPath(userId, randomUUID());

  try {
    const { data, error } = await createServiceClient()
      .storage.from(MANUSCRIPT_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data) return null;

    return { path: data.path, token: data.token };
  } catch {
    return null;
  }
}

export type ManuscriptObjectCheck =
  | { ok: true; sizeBytes: number; sha256: string }
  | { ok: false; message: string };

function isPdfContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return contentType.split(";")[0]?.trim().toLowerCase() === MANUSCRIPT_PDF_MIME;
}

/**
 * Re-verifies an uploaded object with the service role.
 *
 * `info()` gives the size and MIME Supabase actually stored; `download()`
 * gives the bytes, which are hashed here. A client cannot forge any of the
 * three because the submission action trusts only this result.
 */
export async function verifyManuscriptObject(params: {
  userId: string;
  path: string;
  declaredBytes: number;
  expectedSha256: string;
}): Promise<ManuscriptObjectCheck> {
  if (!isManuscriptObjectPathForUser(params.userId, params.path)) {
    return { ok: false, message: "That upload does not belong to your account." };
  }

  const expectedSha256 = params.expectedSha256.trim().toLowerCase();
  if (!isSha256Hex(expectedSha256)) {
    return { ok: false, message: "The file checksum is missing. Please upload the PDF again." };
  }

  let storage;
  try {
    storage = createServiceClient().storage.from(MANUSCRIPT_BUCKET);
  } catch {
    return { ok: false, message: "Uploads are temporarily unavailable. Please try again later." };
  }

  let sizeBytes: number;
  try {
    const info = await storage.info(params.path);
    if (info.error || !info.data) {
      return { ok: false, message: "We could not find the uploaded PDF. Please upload it again." };
    }

    sizeBytes = info.data.size ?? 0;
    if (!isPdfContentType(info.data.contentType)) {
      return { ok: false, message: "The uploaded file is not a PDF." };
    }
  } catch {
    return { ok: false, message: "We could not read the uploaded PDF. Please try again." };
  }

  if (sizeBytes <= 0 || sizeBytes > MAX_MANUSCRIPT_BYTES) {
    return { ok: false, message: "The uploaded PDF is empty or larger than 25 MB." };
  }
  if (sizeBytes !== params.declaredBytes) {
    return {
      ok: false,
      message: "The upload did not finish correctly. Please upload the PDF again.",
    };
  }

  let bytes: Buffer;
  try {
    const download = await storage.download(params.path);
    if (download.error || !download.data) {
      return { ok: false, message: "We could not read the uploaded PDF. Please try again." };
    }
    bytes = Buffer.from(await download.data.arrayBuffer());
  } catch {
    return { ok: false, message: "We could not read the uploaded PDF. Please try again." };
  }

  if (bytes.byteLength !== sizeBytes) {
    return {
      ok: false,
      message: "The upload did not finish correctly. Please upload the PDF again.",
    };
  }

  const sha256 = sha256Hex(bytes);
  if (sha256 !== expectedSha256) {
    return {
      ok: false,
      message: "The uploaded PDF did not match the file you selected. Please try again.",
    };
  }

  return { ok: true, sizeBytes, sha256 };
}

/** Best-effort cleanup for an upload that never became a `ManuscriptFile`. */
export async function deleteManuscriptObject(path: string): Promise<void> {
  if (!MANUSCRIPT_PATH_PATTERN.test(path)) return;

  try {
    await createServiceClient().storage.from(MANUSCRIPT_BUCKET).remove([path]);
  } catch {
    // The orphaned-asset cron is the backstop; a failed cleanup must never
    // turn a rejected submission into a 500.
  }
}
