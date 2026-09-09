/**
 * Normalizes email addresses for authentication and account-uniqueness checks.
 *
 * The normalization rules intentionally only special-case providers whose
 * aliasing behavior is well-defined for this use case. Other domains retain
 * dots in their local part while still dropping plus-addressing tags.
 */
export function normalizeEmail(rawEmail: string): string {
  if (!rawEmail || typeof rawEmail !== "string") return "";

  const trimmed = rawEmail.trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");

  // Keep the sanitized value for validation to reject at the call site.
  if (atIndex === -1 || atIndex !== trimmed.lastIndexOf("@")) {
    return trimmed;
  }

  let local = trimmed.slice(0, atIndex);
  let domain = trimmed.slice(atIndex + 1);

  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }

  if (domain === "gmail.com") {
    local = local.replace(/\./g, "");
  }

  const plusIndex = local.indexOf("+");
  if (plusIndex !== -1) {
    local = local.slice(0, plusIndex);
  }

  return `${local}@${domain}`;
}

/**
 * Performs a deliberately small, provider-agnostic email format check.
 * Provider-specific rules belong in normalizeEmail, not in this validator.
 */
export function validateEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") return false;

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) return false;

  // Require a non-empty domain and a dot-separated top-level domain while
  // rejecting whitespace and additional @ symbols.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
