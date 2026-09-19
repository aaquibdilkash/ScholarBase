export function validateExternalUrl(
  value: string | null | undefined,
  label = "URL",
  maxLength?: number,
  allowEmail = false,
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }

  if (allowEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmed)) {
      return `mailto:${trimmed}`;
    }
    if (trimmed.startsWith("mailto:")) {
      const email = trimmed.slice(7);
      if (emailRegex.test(email)) {
        return trimmed;
      }
    }
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }
    return url.toString();
  } catch {
    if (allowEmail) {
      throw new Error(`${label} must be a valid URL or email address.`);
    }
    throw new Error(`${label} must be a valid http or https URL.`);
  }
}
