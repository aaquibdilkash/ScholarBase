import { headers } from "next/headers";

/**
 * Returns the base URL for server-side requests.
 * It uses the 'host' header to construct the full URL.
 * This function is intended for server-side use only and is asynchronous.
 */
export async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
