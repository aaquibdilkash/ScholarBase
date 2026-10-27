import { headers } from "next/headers";

/**
 * Hostnames that can only ever be reachable from inside the deployment. A link
 * built from one of these is dead for every recipient, so they are never used
 * as a public base URL.
 */
const INTERNAL_HOSTNAMES = new Set(["0.0.0.0", "127.0.0.1", "::1", "localhost"]);

const INTERNAL_HOST_SUFFIXES = [".localhost", ".local", ".internal"];

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isInternalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (INTERNAL_HOSTNAMES.has(host)) return true;
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return true;
  }

  // Container/service names (`scholarbase-web-1`) are single-label. Public
  // hosts always carry a dot, and public IPv6 literals carry a colon.
  return !host.includes(".") && !host.includes(":");
}

/**
 * Parses an environment/header value into a base URL, or returns null when the
 * value is unusable. A bare host (`scholarbase.app`) is treated as `https://`;
 * trailing slashes are dropped.
 */
function parseBaseUrl(value: string | null | undefined): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatBaseUrl(parsed: URL): string {
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${path}`;
}

async function getHeaderBaseUrl(): Promise<string | null> {
  try {
    const headersList = await headers();
    const host =
      headersList.get("x-forwarded-host") || headersList.get("host");

    if (!host) return null;

    const forwardedProto = headersList.get("x-forwarded-proto");
    const proto =
      forwardedProto ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");

    const parsed = parseBaseUrl(`${proto}://${host}`);
    if (!parsed) return null;
    if (isProduction() && isInternalHostname(parsed.hostname)) return null;

    return formatBaseUrl(parsed);
  } catch {
    // headers() throws outside of an active request (background jobs, static
    // generation), in which case there is no request origin to use.
    return null;
  }
}

/**
 * Accepted sources for the public origin, in precedence order.
 *
 * `NEXT_PUBLIC_SITE_URL` is the canonical one, but the Dockerfile and CI also
 * ship `NEXT_PUBLIC_APP_URL`, and a deployment that sets only that (or a
 * runtime-only `APP_URL`) was otherwise ignored and fell through to the request
 * origin. `APP_URL` is deliberately non-public so it can be changed without
 * rebuilding the image.
 */
const BASE_URL_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
] as const;

/**
 * Returns the public base URL used for links we put in front of users — email
 * verification links and OAuth redirects.
 *
 * Resolution order: configured env (see `BASE_URL_ENV_KEYS`), then the request
 * origin. In production the request origin is only trusted when it is a public
 * host; failing everything throws instead of returning something like
 * `http://0.0.0.0:3000`, because a thrown error is visible in logs while a dead
 * link is only discovered by the recipient.
 */
export async function getBaseUrl(): Promise<string> {
  for (const key of BASE_URL_ENV_KEYS) {
    const parsed = parseBaseUrl(process.env[key]);
    if (!parsed) continue;

    // In production an internal value is a misconfiguration, not a base URL.
    if (!isProduction() || !isInternalHostname(parsed.hostname)) {
      return formatBaseUrl(parsed);
    }

    console.error(
      `[url] ${key} points at an internal host (${parsed.hostname}); ignoring it.`,
    );
  }

  const headerBaseUrl = await getHeaderBaseUrl();
  if (headerBaseUrl) return headerBaseUrl;

  if (isProduction()) {
    throw new Error(
      "Unable to resolve the public site URL. Set NEXT_PUBLIC_SITE_URL (or " +
        "APP_URL) to the public origin, for example https://scholarbase.app.",
    );
  }

  // Local development fallback.
  return "http://localhost:3000";
}
