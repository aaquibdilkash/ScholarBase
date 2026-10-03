import { describe, expect, it } from "vitest";
import { requireEnv, validateProductionSecrets } from "@/lib/env";

describe("production secret hardening", () => {
    const env = process.env as Record<string, string | undefined>;

    it("throws in production if a required variable is missing", () => {
        const oldNodeEnv = env.NODE_ENV;
        const oldValue = env.RESEND_API_KEY;
        env.NODE_ENV = "production";
        delete env.RESEND_API_KEY;

        try {
            expect(() => requireEnv("RESEND_API_KEY")).toThrow(
                "Missing required environment variable: RESEND_API_KEY",
            );
        } finally {
            if (oldValue === undefined) delete env.RESEND_API_KEY;
            else env.RESEND_API_KEY = oldValue;
            if (oldNodeEnv === undefined) delete env.NODE_ENV;
            else env.NODE_ENV = oldNodeEnv;
        }
    });

    it("allows dev fallback values for local-only tasks", () => {
        const oldNodeEnv = env.NODE_ENV;
        const oldValue = env.CRON_SECRET;
        env.NODE_ENV = "development";
        delete env.CRON_SECRET;

        try {
            expect(requireEnv("CRON_SECRET", "dev-local-cron-secret")).toBe(
                "dev-local-cron-secret",
            );
        } finally {
            if (oldValue === undefined) delete env.CRON_SECRET;
            else env.CRON_SECRET = oldValue;
            if (oldNodeEnv === undefined) delete env.NODE_ENV;
            else env.NODE_ENV = oldNodeEnv;
        }
    });

    it("validates the production secret set for critical services", () => {
        const oldNodeEnv = env.NODE_ENV;
        const oldResend = env.RESEND_API_KEY;
        const oldQstash = env.QSTASH_TOKEN;
        const oldCron = env.CRON_SECRET;
        const oldSiteUrl = env.NEXT_PUBLIC_SITE_URL;

        env.NODE_ENV = "production";
        env.RESEND_API_KEY = "resend-prod";
        env.QSTASH_TOKEN = "qstash-prod";
        env.CRON_SECRET = "cron-prod";
        env.NEXT_PUBLIC_SITE_URL = "https://example.com";

        try {
            expect(() => validateProductionSecrets()).not.toThrow();
        } finally {
            if (oldResend === undefined) delete env.RESEND_API_KEY;
            else env.RESEND_API_KEY = oldResend;
            if (oldQstash === undefined) delete env.QSTASH_TOKEN;
            else env.QSTASH_TOKEN = oldQstash;
            if (oldCron === undefined) delete env.CRON_SECRET;
            else env.CRON_SECRET = oldCron;
            if (oldSiteUrl === undefined) delete env.NEXT_PUBLIC_SITE_URL;
            else env.NEXT_PUBLIC_SITE_URL = oldSiteUrl;
            if (oldNodeEnv === undefined) delete env.NODE_ENV;
            else env.NODE_ENV = oldNodeEnv;
        }
    });
});
