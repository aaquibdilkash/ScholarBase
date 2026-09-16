import type { AnchorHTMLAttributes, ReactNode } from "react";
import { validateEmailFormat } from "@/lib/email-normalizer";

const FALLBACK_DASH = <span className="text-slate-400">—</span>;

function getSafeHttpUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

type SafeExternalLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "target" | "rel"
> & {
  url: string | null | undefined;
  children?: ReactNode;
  fallback?: ReactNode;
};

/**
 * DRY external link used everywhere user-supplied URLs are rendered.
 * Sanitizes at render time (http/https only) so legacy rows that predate
 * `validateExternalUrl()` write-time validation can't produce
 * `javascript:`/`data:` hrefs. Direct link, no `/api/outbound` indirection.
 */
export function SafeExternalLink({
  url,
  children,
  fallback = null,
  ...rest
}: SafeExternalLinkProps) {
  const safeUrl = getSafeHttpUrl(url);
  if (!safeUrl) return <>{fallback}</>;
  return (
    <a href={safeUrl} target="_blank" rel="noopener noreferrer" {...rest}>
      {children ?? safeUrl}
    </a>
  );
}

type SafeEmailLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  email: string | null | undefined;
  children?: ReactNode;
  fallback?: ReactNode;
};

/**
 * DRY email link. Validates format at render time and renders a
 * `mailto:` anchor, otherwise falls back to plain text / dash.
 */
export function SafeEmailLink({
  email,
  children,
  fallback = FALLBACK_DASH,
  ...rest
}: SafeEmailLinkProps) {
  if (typeof email !== "string") return <>{fallback}</>;
  const trimmed = email.trim();
  if (!validateEmailFormat(trimmed)) {
    return trimmed ? <span>{trimmed}</span> : <>{fallback}</>;
  }
  return (
    <a href={`mailto:${trimmed}`} {...rest}>
      {children ?? trimmed}
    </a>
  );
}
