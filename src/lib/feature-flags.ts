/**
 * Feature flags
 * --------------
 * Simple, build-time toggles for surfaces that are intentionally hidden from
 * users until a capability is ready.
 *
 * `isComingSoon` gates the entire Contributions feature. ScholarBase does not
 * yet have a way to receive money, so every contribution surface (list, add,
 * detail, and edit) renders a branded "Coming Soon" state instead of the live
 * form/payment UI. Flip this to `false` once the payment flow is live.
 */
export const isComingSoon = true;
