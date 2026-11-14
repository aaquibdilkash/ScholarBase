/**
 * Stub for the `server-only` guard package.
 *
 * The trim-maintenance cron route imports `server-only`, which Next resolves
 * in a real build but which is not a direct dependency here, so Vitest cannot
 * resolve it. Aliasing it to this no-op keeps the marker import in place (so
 * the production guard is untouched) while letting a server component that
 * transitively imports `server-only` be unit tested.
 */
export {};
