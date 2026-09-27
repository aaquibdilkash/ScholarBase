import { beforeEach, describe, expect, it, vi } from "vitest"
import { DeletedByType } from "@prisma/client"
import { fakeDb, resetFakeDb } from "../fake-prisma"
import {
  COMMENT_TYPE_TO_MODULE,
  createCommentTransaction,
  deleteCommentTransaction,
  ENTITY_CONFIG,
  type ModuleKey,
} from "@/lib/transactions"
import type { CommentEntityType } from "@/types/comments"

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance")
  return { default: fakeDb.client }
})

let mockIsAdmin = false

vi.mock("@/lib/auth", () => ({
  isUserAdmin: vi.fn(async () => mockIsAdmin),
  getCurrentUser: vi.fn(async () => null),
}))

const POST_AUTHOR = "u-post-author"
const COMMENT_AUTHOR = "u-comment-author"
const REPLY_AUTHOR = "u-reply-author"
const ADMIN_USER = "u-admin"
const STRANGER = "u-stranger"

const ENTITY_ID = "entity-1"
const PARENT_COMMENT_ID = "comment-parent"
const REPLY_COMMENT_ID = "comment-reply"

const ALL_TYPES = Object.keys(COMMENT_TYPE_TO_MODULE) as CommentEntityType[]

function seedCommentTree(moduleKey: ModuleKey, opts: {
  commentVotes?: number
  replyVotes?: number
  parentHasReplies?: boolean
  parentFrozen?: boolean
  rootFrozen?: boolean
}) {
  const config = ENTITY_CONFIG[moduleKey]

  fakeDb.seed("user", [
    { id: POST_AUTHOR, reputation: 100 },
    { id: COMMENT_AUTHOR, reputation: 100 },
    { id: REPLY_AUTHOR, reputation: 100 },
    { id: ADMIN_USER, reputation: 100 },
    { id: STRANGER, reputation: 100 },
  ])

  fakeDb.seed(config.model, {
    id: ENTITY_ID,
    authorId: POST_AUTHOR,
    [config.titleField]: "Test Entity Title",
    totalComments: opts.parentHasReplies ? 2 : 1,
    isFrozen: opts.rootFrozen ?? false,
  })

  fakeDb.seed(config.commentModel, {
    id: PARENT_COMMENT_ID,
    [config.commentFk]: ENTITY_ID,
    authorId: COMMENT_AUTHOR,
    content: "Root comment text",
    parentId: null,
    totalVotes: opts.commentVotes ?? 0,
    totalReplies: opts.parentHasReplies ? 1 : 0,
    isDeleted: false,
    isFrozen: opts.parentFrozen ?? false,
  })

  if (opts.parentHasReplies) {
    fakeDb.seed(config.commentModel, {
      id: REPLY_COMMENT_ID,
      [config.commentFk]: ENTITY_ID,
      authorId: REPLY_AUTHOR,
      content: "Nested reply text",
      parentId: PARENT_COMMENT_ID,
      totalVotes: opts.replyVotes ?? 0,
      totalReplies: 0,
      isDeleted: false,
      isFrozen: false,
    })
  }
}

describe("RULE 4 & RULE 3: Comment creation transactions", () => {
  beforeEach(() => {
    resetFakeDb()
    mockIsAdmin = false
  })

  for (const commentType of ALL_TYPES) {
    const moduleKey = COMMENT_TYPE_TO_MODULE[commentType]
    const config = ENTITY_CONFIG[moduleKey]

    describe(`${commentType} -> ${moduleKey} create`, () => {
      it("creates a top-level comment, increments totalComments, logs activity", async () => {
        seedCommentTree(moduleKey, { parentHasReplies: false })

        const result = await createCommentTransaction(
          moduleKey,
          ENTITY_ID,
          COMMENT_AUTHOR,
          "New comment text",
        )

        expect(result.id).toBeDefined()
        expect(result.content).toBe("New comment text")
        expect(result.totalVotes).toBe(0)
        expect(result.totalReplies).toBe(0)

        const parentEntity = fakeDb.rows(config.model)[0]
        expect(parentEntity.totalComments).toBe(2)

        const activities = fakeDb.rows("userActivity")
        const commentActivity = activities.find((a) => a.action === "COMMENTED")!
        expect(commentActivity).toBeDefined()
        expect(commentActivity.moduleType).toBe(moduleKey)
        expect(commentActivity.entityId).toBe(ENTITY_ID)
      })

      it("creates a reply, increments totalReplies on parent comment and totalComments on root", async () => {
        seedCommentTree(moduleKey, { parentHasReplies: false })

        const result = await createCommentTransaction(
          moduleKey,
          ENTITY_ID,
          REPLY_AUTHOR,
          "Reply content",
          PARENT_COMMENT_ID,
        )

        expect(result.parentId).toBe(PARENT_COMMENT_ID)

        const parentComment = fakeDb.rows(config.commentModel).find((c) => c.id === PARENT_COMMENT_ID)!
        expect(parentComment.totalReplies).toBe(1)

        const rootEntity = fakeDb.rows(config.model)[0]
        expect(rootEntity.totalComments).toBe(2)

        const activities = fakeDb.rows("userActivity")
        const replyActivity = activities.find((a) => a.action === "REPLIED")!
        expect(replyActivity).toBeDefined()
      })

      it("blocks comment creation when the root entity is frozen", async () => {
        seedCommentTree(moduleKey, { rootFrozen: true })

        await expect(
          createCommentTransaction(moduleKey, ENTITY_ID, COMMENT_AUTHOR, "Blocked text"),
        ).rejects.toThrow(/frozen by moderators/)
      })

      it("blocks reply creation when parent comment is frozen", async () => {
        seedCommentTree(moduleKey, { parentFrozen: true })

        await expect(
          createCommentTransaction(
            moduleKey,
            ENTITY_ID,
            REPLY_AUTHOR,
            "Blocked reply",
            PARENT_COMMENT_ID,
          ),
        ).rejects.toThrow(/frozen by moderators/)
      })
    })
  }
})

describe("RULE 4 & RULE 3: Comment deletion mechanics (tombstones & reputation reversal)", () => {
  beforeEach(() => {
    resetFakeDb()
    mockIsAdmin = false
  })

  for (const commentType of ALL_TYPES) {
    const moduleKey = COMMENT_TYPE_TO_MODULE[commentType]
    const config = ENTITY_CONFIG[moduleKey]

    describe(`${commentType} -> ${moduleKey} delete`, () => {
      it("hard-hides comment (showTombstone: false) when totalReplies === 0 and decrements parent totalComments", async () => {
        const START_VOTES = 5
        seedCommentTree(moduleKey, { parentHasReplies: false, commentVotes: START_VOTES })

        const result = await deleteCommentTransaction(moduleKey, PARENT_COMMENT_ID, COMMENT_AUTHOR)

        expect(result.showTombstone).toBe(false)
        expect(result.deletedByType).toBe(DeletedByType.AUTHOR)

        const comment = fakeDb.rows(config.commentModel).find((c) => c.id === PARENT_COMMENT_ID)!
        expect(comment.isDeleted).toBe(true)
        expect(comment.deletedById).toBe(COMMENT_AUTHOR)

        const parentEntity = fakeDb.rows(config.model)[0]
        expect(parentEntity.totalComments).toBe(0)

        const author = fakeDb.rows("user").find((u) => u.id === COMMENT_AUTHOR)!
        expect(author.reputation).toBe(100 - START_VOTES)
      })

      it("shows tombstone (showTombstone: true) when parent comment has totalReplies > 0", async () => {
        seedCommentTree(moduleKey, { parentHasReplies: true, commentVotes: 3 })

        const result = await deleteCommentTransaction(moduleKey, PARENT_COMMENT_ID, COMMENT_AUTHOR)

        expect(result.showTombstone).toBe(true)
        expect(result.deletedByType).toBe(DeletedByType.AUTHOR)

        const comment = fakeDb.rows(config.commentModel).find((c) => c.id === PARENT_COMMENT_ID)!
        expect(comment.isDeleted).toBe(true)
        expect(comment.totalReplies).toBe(1)

        const parentEntity = fakeDb.rows(config.model)[0]
        expect(parentEntity.totalComments).toBe(1)
      })

      it("deleting a reply decrements parent comment's totalReplies and never tombstones the reply", async () => {
        seedCommentTree(moduleKey, { parentHasReplies: true, replyVotes: 2 })

        const result = await deleteCommentTransaction(moduleKey, REPLY_COMMENT_ID, REPLY_AUTHOR)

        expect(result.showTombstone).toBe(false)
        expect(result.parentId).toBe(PARENT_COMMENT_ID)
        expect(result.deletedByType).toBe(DeletedByType.AUTHOR)

        const parentComment = fakeDb.rows(config.commentModel).find((c) => c.id === PARENT_COMMENT_ID)!
        expect(parentComment.totalReplies).toBe(0)

        const replyAuthor = fakeDb.rows("user").find((u) => u.id === REPLY_AUTHOR)!
        expect(replyAuthor.reputation).toBe(98)
      })

      it("allows post author to delete any comment with POST_AUTHOR attribution", async () => {
        seedCommentTree(moduleKey, { parentHasReplies: false })

        const result = await deleteCommentTransaction(moduleKey, PARENT_COMMENT_ID, POST_AUTHOR)

        expect(result.deletedByType).toBe(DeletedByType.POST_AUTHOR)
        const comment = fakeDb.rows(config.commentModel).find((c) => c.id === PARENT_COMMENT_ID)!
        expect(comment.deletedByType).toBe(DeletedByType.POST_AUTHOR)
        expect(comment.deletedById).toBe(POST_AUTHOR)
      })

      it("allows parent comment author to delete a child reply with PARENT_COMMENT_AUTHOR attribution", async () => {
        seedCommentTree(moduleKey, { parentHasReplies: true })

        const result = await deleteCommentTransaction(moduleKey, REPLY_COMMENT_ID, COMMENT_AUTHOR)

        expect(result.deletedByType).toBe(DeletedByType.PARENT_COMMENT_AUTHOR)
      })

      it("allows admin to delete any comment with ADMIN attribution", async () => {
        mockIsAdmin = true
        seedCommentTree(moduleKey, { parentHasReplies: false })

        const result = await deleteCommentTransaction(moduleKey, PARENT_COMMENT_ID, ADMIN_USER)

        expect(result.deletedByType).toBe(DeletedByType.ADMIN)
      })

      it("rejects unauthorized strangers with permission error", async () => {
        seedCommentTree(moduleKey, { parentHasReplies: false })

        await expect(
          deleteCommentTransaction(moduleKey, PARENT_COMMENT_ID, STRANGER),
        ).rejects.toThrow(/You do not have permission/)
      })

      it("rejects double deletion", async () => {
        seedCommentTree(moduleKey, { parentHasReplies: false })
        await deleteCommentTransaction(moduleKey, PARENT_COMMENT_ID, COMMENT_AUTHOR)

        await expect(
          deleteCommentTransaction(moduleKey, PARENT_COMMENT_ID, COMMENT_AUTHOR),
        ).rejects.toThrow(/already deleted/)
      })
    })
  }
})
