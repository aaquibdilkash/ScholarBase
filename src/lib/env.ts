export function isProductionEnv(): boolean {
    return process.env.NODE_ENV === "production";
}

// Next.js sets NEXT_PHASE while `next build` runs. Runtime secrets are not
// available at build time, so the production check must not run then.
export function isBuildPhase(): boolean {
    return (
        process.env.NEXT_PHASE === "phase-production-build" ||
        process.env.SKIP_ENV_VALIDATION === "true"
    );
}

export function requireEnv(key: string, fallback?: string): string {
    const value = process.env[key]?.trim();

    if (value) {
        return value;
    }

    // Only throw at runtime in production, never during `next build`
    if (isProductionEnv() && !isBuildPhase()) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    if (fallback !== undefined) {
        return fallback;
    }

    // Return a non-empty placeholder during `next build` so top-level SDK 
    // constructors (like Upstash QStash or Resend) don't crash on empty strings
    if (isBuildPhase()) {
        return `build-placeholder-${key}`;
    }

    return "";
}

export function validateProductionSecrets(): void {
    const required = [
        "CRON_SECRET",
        "QSTASH_TOKEN",
        "RESEND_API_KEY",
    ] as const;

    for (const key of required) {
        requireEnv(key);
    }
}

if (isProductionEnv() && !isBuildPhase()) {
    validateProductionSecrets();
}