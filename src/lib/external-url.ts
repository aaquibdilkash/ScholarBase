import { stripMailtoPrefix, validateEmailFormat } from "./email-normalizer";

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
    // Strip ALL leading `mailto:` (case-insensitive, repeated) first so a
    // value saved by the old buggy writer (`mailto:a@b.com`) or pasted with a
    // prefix can never chain into `mailto:mailto:...`. Only the bare email is
    // ever stored — `mailto:` is added back at render time only.
    const bare = stripMailtoPrefix(trimmed);
    if (validateEmailFormat(bare)) {
      return bare;
    }
    // Input looked like an email attempt but failed validation — reject with
    // an email-specific message instead of falling through to the URL branch.
    if (/^mailto:/i.test(trimmed) || trimmed.includes("@")) {
      throw new Error(`${label} must be a valid email address.`);
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
