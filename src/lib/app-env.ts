// Single source of truth for the deployment environment.
// VERCEL_ENV remains a transitional fallback for existing Vercel deployments.
const raw =
  process.env.APP_ENV ??
  process.env.VERCEL_ENV ??
  process.env.NODE_ENV ??
  "development";

export const APP_ENV: string = raw;
export const IS_PRODUCTION: boolean = raw === "production";

export const CLIENT_APP_ENV: string =
  process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "development";
export const CLIENT_IS_PRODUCTION: boolean = CLIENT_APP_ENV === "production";
