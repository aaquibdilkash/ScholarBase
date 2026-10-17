import type { AnchorHTMLAttributes, ReactNode } from "react";
import { SafeExternalLink } from "./SafeExternalLink";
import { SafeEmailLink } from "./SafeExternalLink";
import { stripMailtoPrefix, validateEmailFormat } from "@/lib/email-normalizer";

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

type SmartExternalLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "target" | "rel"
> & {
  url: string | null | undefined;
  children?: ReactNode;
  fallback?: ReactNode;
  emailLabel?: string;
  urlLabel?: string;
};

export function SmartExternalLink({
  url,
  children,
  fallback = FALLBACK_DASH,
  emailLabel = "Contact",
  urlLabel = "Visit",
  ...rest
}: SmartExternalLinkProps) {
  const safeUrl = getSafeHttpUrl(url);
  if (safeUrl) {
    return (
      <SafeExternalLink url={safeUrl} {...rest}>
        {children ?? urlLabel}
      </SafeExternalLink>
    );
  }

  if (typeof url === "string") {
    // Defensive: DB rows written before the bare-email fix may still carry
    // `mailto:` (or chained `mailto:mailto:...`). Strip before validating so
    // legacy rows still render a working single-`mailto:` anchor.
    const bare = stripMailtoPrefix(url);
    if (validateEmailFormat(bare)) {
      return (
        <SafeEmailLink email={bare} {...rest}>
          {children ?? emailLabel}
        </SafeEmailLink>
      );
    }
  }

  return <>{fallback}</>;
}