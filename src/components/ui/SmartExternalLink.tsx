import type { AnchorHTMLAttributes, ReactNode } from "react";
import { SafeExternalLink } from "./SafeExternalLink";
import { SafeEmailLink } from "./SafeExternalLink";
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
    const trimmed = url.trim();
    if (validateEmailFormat(trimmed)) {
      return (
        <SafeEmailLink email={trimmed} {...rest}>
          {children ?? emailLabel}
        </SafeEmailLink>
      );
    }
  }

  return <>{fallback}</>;
}