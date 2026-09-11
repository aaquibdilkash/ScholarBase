export function validateExternalUrl(
  value: string | null | undefined,
  label = "URL",
  maxLength?: number,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error(`${label} must be a valid http or https URL.`);
  }
}
