import { headers } from "next/headers";

/**
 * Returns the base URL for server-side requests.
 * It uses VERCEL_URL for Vercel deployments, otherwise falls back to the host header.
 */
export async function getBaseUrl() {
    let host;
    if (process.env.VERCEL_URL) {
        host = process.env.VERCEL_URL;
    } else {
        const headersList = await headers();
        host = headersList.get('host');
    }

    if (!host) {
        // Fallback for safety, though should be rare.
        return 'http://localhost:3000';
    }
    
    // Determine the protocol.
    const protocol = host.startsWith('localhost') ? 'http' : 'https';

    return `${protocol}://${host}`;
}
