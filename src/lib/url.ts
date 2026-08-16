import { headers } from "next/headers";

/**
 * Returns the base URL for server-side requests.
 * It prioritizes Vercel environment variables for efficiency, 
 * falling back to the host header for other environments.
 */
export async function getBaseUrl() {
    const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (explicitSiteUrl) {
        return explicitSiteUrl.replace(/\/+$/, '');
    }

    // Prioritize Vercel's environment variables.
    const vercelHost = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
    if (vercelHost) {
        const protocol = vercelHost.startsWith('localhost') ? 'http' : 'https';
        return `${protocol}://${vercelHost}`;
    }

    // Fallback for other environments (e.g., local `npm run dev`).
    const headersList = await headers();
    const hostHeader = headersList.get('host');
    
    if (!hostHeader) {
        return 'http://localhost:3000'; // Safety fallback.
    }

    const protocol = hostHeader.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${hostHeader}`;
}
