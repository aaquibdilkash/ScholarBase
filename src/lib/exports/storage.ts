import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { createServiceClient } from "@/utils/supabase/service";

export const EXPORTS_BUCKET = "exports";
export const EXPORTS_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export function exportObjectPath(userId: string, jobId: string, ext: "csv" | "xlsx"): string {
  return `users/${userId}/exports/${jobId}.${ext}`;
}

export function isExportObjectPathForUser(userId: string, path: string): boolean {
  return new RegExp(`^users/${userId}/exports/[A-Za-z0-9-]+\\.(csv|xlsx)$`).test(path);
}

export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function uploadExportObject(
  path: string,
  body: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  return { error: error?.message ?? null };
}

export async function createSignedExportUrl(path: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(path, EXPORTS_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function deleteExportObject(path: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.storage.from(EXPORTS_BUCKET).remove([path]);
}

export { randomUUID };
