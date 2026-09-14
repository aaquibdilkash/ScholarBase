<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# ScholarBase - AI Agent Master Guidelines
**Project Context:** ScholarBase is a high-performance, Next.js 14+ (App Router) academic networking platform using Prisma and PostgreSQL (Supabase). 

## Core Philosophy
1. **Protect the Free Tier:** Database compute and connection pools are our most precious resources.
2. **Zero-Compute Reads:** Read operations must be lightning-fast, utilizing materialized data and indexes over on-the-fly aggregations.
3. **Optimistic UI:** The UI must feel instantaneous. We do not wait for database round-trips for micro-interactions.
4. **Academic Integrity:** Reputation is sacred. Bad actors cannot farm points or manipulate the system.

Any code generated for this project MUST strictly adhere to the following architectural rules.

---

## RULE 1: Strict Client-Side State Mutation
**NEVER use `revalidatePath` for highly interactive UI elements (Votes, Comments, Follows).**
1. **Server Actions:** Must return the complete, newly updated/created database object (e.g., `{ success: true, data: newPost }`).
2. **React Query:** Use `queryClient.setQueryData` to surgically update lists, comments, and nested replies upon successful Server Actions.
3. **Micro-Interactions (`useOptimistic`):** For Upvotes, Downvotes, and Follows, bypass React Query. Use React's native `useOptimistic` hook to update the UI instantly, then fire the Server Action to sync the database in the background.

## RULE 2: Database Read Optimizations (Zero-Compute)
**NEVER use dynamic `_count`, full-table scans, or `Promise.all` waterfalls for feeds.**
1. **Materialized Counters:** Always rely on static integer fields (`totalVotes`, `totalComments`) instead of dynamic relation counting. Comments also carry `totalReplies`. (`totalAnswers` exists only on `SurveyQuestion` for survey answer counts, not as a standard entity counter.)
2. **Filtered Selects:** Resolve the N+1 problem by fetching the current user's state directly in the main query: `votes: { where: { userId: currentUserId }, select: { voteType: true } }`.
3. **Unread Badges:** Never fetch arrays into memory to count them. Use indexed counts: `await prisma.notification.count({ where: { recipientId: userId, readAt: null } })`. For messages, unread counts are computed via a single indexed raw SQL join between `Message` and `ConversationParticipant` (see `getUnreadMessageCount`), avoiding per-conversation count queries.
4. **Dashboard Stats:** Use raw SQL (`prisma.$queryRaw`) against the `pg_class` system catalog for global row counts.

## RULE 3: Database Write Optimizations & Voting Rules
1. **Atomic Transactions:** Any user interaction (Voting, Commenting, Replying) must execute completely inside a `prisma.$transaction`. 
2. **Stack Overflow Reputation System:** User reputation is tied strictly to community votes (1 vote = 1 rep).
3. **The Voting Matrix:** 
   - *New Vote:* Upsert vote + adjust `totalVotes` + adjust author `reputation`.
   - *Toggle Off:* Delete vote + reverse `totalVotes` + reverse author `reputation`.
   - *Switch Vote:* Update vote + double-adjust `totalVotes` + double-adjust author `reputation`.
4. **Reputation Reversal:** If a user deletes a post, they MUST lose the exact amount of reputation they gained from that post's `totalVotes`.
5. **Timestamp Integrity:** Never assume `updatedAt` means the user edited a post. `updatedAt` updates on every vote/comment counter increment. Use the manual `editedAt DateTime?` field to track actual content changes.

## RULE 4: Data Deletion Mechanics
1. **Tombstone Pattern:** For all entities like Comments and Replies, NEVER hard-delete. Show deleted comments as tombstones if `totalReplies > 0` (with an option to expand and see their replies). If `totalReplies == 0`, hide the deleted comment entirely. Tombstones display "Deleted by [admin / post author / comment author / reply author]" depending on who performed the deletion (as wired in the codebase).
2. **Soft Deletes:** Main content feeds (`SocialPost`, `Article`, etc.) use soft deletes (`isDeleted: true`) to preserve historical integrity while hiding the content from the feed. Hard deletion of soft-deleted rows is handled by a background cron (`trim-soft-deleted-posts`).

## RULE 5: Indexing Strategy
Ensure Prisma schema utilizes strategic B-Tree indexing to prevent CPU spikes:
1. **Top-Level Feeds:** `@@index([createdAt(sort: Desc)])`
2. **Trending Feeds:** `@@index([trendingScore(sort: Desc)])`
3. **Nested Comments:** `@@index([socialPostId, createdAt(sort: Desc)])`
4. **Unread Badges:** `@@index([recipientId, readAt, createdAt(sort: Desc)])` on the `Notification` model (crucial for unread count queries).
5. **User Directory:** `@@index([trendingScore(sort: Desc)])` and `@@index([reputation(sort: Desc)])` on the `User` model (powers the scholar directory and trending scholar queries).

## RULE 6: Background Processing & Security
1. **Cron Jobs:** Background tasks are handled via Vercel Serverless Cron Jobs calling `prisma.$executeRawUnsafe`. They must be protected by a `CRON_SECRET` authorization header. The cron suite includes: Trending math (`update-trending`), conversation trimming (`trim-maintenance`), deadline cleanup (`cleanup-deadlines`), soft-deleted post purging (`trim-soft-deleted-posts`), and digest email dispatch (`daily-digest`, `weekly-digest`).
2. **Link Masking:** Protect user privacy and track outbound clicks. Replace external `<a href="https://...">` tags with internal routes: `<a href="/api/outbound?url=[encoded_url]">`.
3. **File Tracking:** Avoid unused imports, clean up unneeded dependencies, and resolve all TypeScript/ESLint warnings before marking a feature complete.

**AGENT DIRECTIVE:** When asked to create or modify a feature, cross-reference these 6 rules. Do not take shortcuts that compromise database efficiency or UI responsiveness.

<!-- END:nextjs-agent-rules -->
