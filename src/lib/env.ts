export function isProductionEnv(): boolean {

    return process.env.NODE_ENV === "production";
}

export function requireEnv(key: string, fallback?: string): string {
    const value = process.env[key]?.trim();

    if (value) {
        return value;
    }

    if (isProductionEnv()) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    if (fallback !== undefined) {
        return fallback;
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

if (isProductionEnv()) {
    validateProductionSecrets();
}
