/**
 * Shared activity types used in the scholar profile activity tab.
 *
 * RULE 7 (Global Activity Log): Profile activity is read from the single
 * `UserActivity` table — a pre-joined, static feed row. No N+1 waterfall over
 * content tables and no relational `_count` queries are ever issued.
 */

/** A single row from the UserActivity log (as selected by getProfileActivity). */
export interface ActivityItem {
    id: string;
    /** Uppercase action, e.g. 'VOTED' | 'COMMENTED' | 'REPLIED' | 'FOLLOWED'. */
    action: string;
    /** Uppercase module key, e.g. 'SOCIAL_POST' | 'ARTICLE'. */
    moduleType: string;
    entityId: string;
    entityTitle: string;
    createdAt: Date;
}