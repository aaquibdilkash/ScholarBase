import { headers } from "next/headers";

/**
 * Returns the base URL for server-side requests.
 * It prioritizes the configured canonical site URL so auth emails and
 * verification links stay on the approved domain.
 */
export async function getBaseUrl() {
    const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (explicitSiteUrl) {
        return explicitSiteUrl.replace(/\/+$/, '')
    }

    const headersList = await headers();
    const hostHeader = headersList.get('host');

    if (hostHeader) {
        const protocol = hostHeader.startsWith('localhost') ? 'http' : 'https';
        return `${protocol}://${hostHeader}`;
    }

    const vercelHost = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
    if (vercelHost) {
        const protocol = vercelHost.startsWith('localhost') ? 'http' : 'https';
        return `${protocol}://${vercelHost}`
    }

    return 'http://localhost:3000'
}
