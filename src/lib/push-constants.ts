/**
 * Shared Web Push constants.
 *
 * Imported by both the browser (activity signal, enable/disable button) and the
 * server (activity store, send worker). This module must stay dependency-free
 * so it can safely cross the client/server boundary.
 */

/**
 * How often a *visible* tab re-asserts that the user is still active.
 *
 * Deliberately slow: the `visibilitychange`/`pagehide` beacon clears presence
 * instantly when a tab is hidden or closed, so this interval only exists as a
 * safety net for hard crashes, force-quits and OS sleep where no beacon can
 * fire.
 */
export const ACTIVITY_HEARTBEAT_MS = 3 * 60 * 1000;

/**
 * A tab is treated as "in use" for this long after its last heartbeat. Kept at
 * 2x the heartbeat interval so a single throttled timer or a sleeping laptop
 * never lets a push slip through while the user is actually looking at the app.
 */
export const ACTIVITY_STALE_MS = 6 * 60 * 1000;

/**
 * Prefix for the Service Worker notification tag. Tagging per conversation
 * collapses repeat messages into one OS notification instead of stacking them.
 */
export const MESSAGE_PUSH_TAG_PREFIX = "message-";

/** Max characters of the message body embedded in the push payload. */
export const PUSH_BODY_MAX_LENGTH = 120;