/**
 * Shared activity types used in profile pages, tabs, and cards.
 */

/** Author of an activity item. */
export interface ActivityAuthor {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
}

/** A unified activity item (comment, reply, or vote) on a profile. */
export interface ActivityItem {
    contentId: string;
    /** Machine type, e.g. "article". */
    type: string;
    /** Human label, e.g. "Research Article". */
    typeLabel: string;
    action: "commented" | "replied" | "voted";
    title: string;
    excerpt?: string;
    href: string;
    author: ActivityAuthor;
    authorId: string;
    createdAt: Date;
}

/** Configuration for fetching a single content type's activity. */
export interface ActivityConfig {
    type: string;
    typeLabel: string;
    commentModel: string;
    voteModel: string;
    /** Relation field on the comment/vote model pointing at the content. */
    contentField: string;
    /** Where the content actually lives (used to fetch the content row). */
    contentModel: string;
    titleField: string;
    excerptField?: string;
    detailHref: (contentId: string) => string;
}
