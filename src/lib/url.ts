import { headers } from "next/headers";

/**
 * Returns the base URL for server-side requests.
 * Prioritizes canonical environment variables, falling back to
 * request headers and localhost.
 */
export async function getBaseUrl(): Promise<string> {
  // 1. Explicit canonical URL.
  const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicitSiteUrl) {
    const formatted = explicitSiteUrl.replace(/\/+$/, "");
    return formatted.startsWith("http") ? formatted : `https://${formatted}`;
  }

  // 2. Request context inspection (wrapped in try/catch for static builds/background jobs)
  try {
    const headersList = await headers();
    const host = headersList.get("x-forwarded-host") || headersList.get("host");

    if (host) {
      const proto =
        headersList.get("x-forwarded-proto") ||
        (host.startsWith("localhost") || host.startsWith("127.0.0.1")
          ? "http"
          : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() throws if invoked outside of an active HTTP request (e.g., static page generation)
  }

  // 3. Default local development fallback
  return "http://localhost:3000";
}
