/**
 * Number and unit formatting shared by the publishing surfaces.
 *
 * One implementation so a file advertised as "24.1 MB" in the submission form,
 * the archive list, and a manuscript timeline is the same number everywhere.
 */

/** Human-readable byte size, capped at MB so a 25 MB PDF reads as "24.1 MB". */
export function formatFileSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
