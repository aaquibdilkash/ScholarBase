// src/lib/shield/masking.ts
// Locks citations / math so tokenization + rewriting never fractures them.

export interface MaskResult {
  maskedText: string;
  restoreMap: Map<string, string>;
}

export function lockAcademicEntities(rawText: string): MaskResult {
  const restoreMap = new Map<string, string>();
  let counter = 0;

  const createMask = (val: string, prefix: string) => {
    const key = `__${prefix}_${counter++}__`;
    restoreMap.set(key, val);
    return key;
  };

  const maskedText = rawText
    .replace(/\$\$[\s\S]+?\$\$/g, (m) => createMask(m, "MATH"))
    .replace(/\$[^$\n]+\$/g, (m) => createMask(m, "MATH"))
    .replace(
      /\([A-Z][a-zA-Z\s,.'&-]+,\s*\d{4}[a-z]?(?:;\s*[A-Z][a-zA-Z\s,.'&-]+,\s*\d{4}[a-z]?)*\)/g,
      (m) => createMask(m, "REF"),
    )
    .replace(/\[\s*\d+(?:[\s,–-]+\d+)*\s*\]/g, (m) => createMask(m, "REF"))
    .replace(/\bet al\./gi, () => createMask("et al.", "ABBR"))
    .replace(/\be\.g\.,?/gi, () => createMask("e.g.,", "ABBR"))
    .replace(/\bi\.e\.,?/gi, () => createMask("i.e.,", "ABBR"))
    .replace(/\bvs\./gi, () => createMask("vs.", "ABBR"))
    .replace(/(\d+)\.(\d+)/g, (m) => createMask(m, "NUM"));

  return { maskedText, restoreMap };
}

export function unlockAcademicEntities(
  maskedText: string,
  restoreMap: Map<string, string>,
): string {
  let restored = maskedText;
  for (const [key, original] of restoreMap.entries()) {
    restored = restored.split(key).join(original);
  }
  return restored;
}
