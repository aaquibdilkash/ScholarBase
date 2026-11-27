import { createHash } from "node:crypto";

export function anonymizeAuthorId(
  studySalt: string,
  platform: string,
  authorId: string | null,
  fallback: string,
): string {
  const key = authorId && authorId.trim() ? authorId : fallback;
  const hash = createHash("sha256").update(`${studySalt}|${platform}|${key}`).digest("hex").slice(0, 8);
  return `Participant_${hash}`;
}

export function cleanText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/\s+/g, " ")
    .trim();
}
