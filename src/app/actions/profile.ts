"use server";

import { cache } from "react";

import prisma from "@/lib/db";
import { getCurrentUser, requireActiveUser } from "@/lib/auth";
import { normalizeHandle, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import {
  deleteCloudinaryAsset,
  promoteDraftCloudinaryAsset,
} from "@/lib/cloudinary";
import { MAX_PROFILE_BIO } from "@/lib/constants";
import { revalidateContent } from "@/lib/tri-split/modules/registry";
import {
  loadProfileActivity,
  loadProfileBookmarkTab,
  loadProfileContentTab,
} from "@/lib/tri-split/modules/profile-tab";
import { validateExternalUrl } from "@/lib/external-url";
import { PROFILE_SECTION_CONFIG, type ProfileSection } from "@/lib/module-registry";

export const getProfile = cache(
  async (profileId: string, currentUserId?: string) => {
    const userWithProfileData = await prisma.user.findUnique({
      where: { id: profileId, isDeleted: false },
      select: {
        id: true,
        name: true,
        handle: true,
        avatarUrl: true,
        bio: true,
        institutionDomain: true,
        institutionVerifiedAt: true,
        githubUrl: true,
        orcidUrl: true,
        linkedinUrl: true,
        googleScholarUrl: true,
        createdAt: true,
        reputation: true,
        followersCount: true, // Use materialized counter
        followingCount: true, // Use materialized counter
        isFrozen: true,
        isDeleted: true,
        hasActiveAppeal: true,
        followers: currentUserId
          ? {
            where: { followerId: currentUserId },
            select: { followerId: true },
          }
          : false,
      },
    });

    if (!userWithProfileData) return null;

    const { followers, ...rest } = userWithProfileData;

    return {
      ...rest,
      isFollowing: !!followers?.length,
      isOwnProfile: currentUserId === profileId,
    };
  },
);

// ─────────────────────────────────────────────────────────────
// Content sections (tabs) on the scholar profile.
// ZERO-COMPUTE: each section is loaded with `include`, returning the
// materialized `totalVotes` / `totalComments` / `totalResponses`
// scalars directly. No relational `_count` aggregations are run. The
// current user's vote & follow state is resolved with filtered selects
// (N+1 fix) instead of fetching the full relation arrays.
// ─────────────────────────────────────────────────────────────

function getProfileAuthorInclude(currentUserId?: string) {
  return {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true, institutionVerifiedAt: true,
      createdAt: true,
      email: true,
      bio: true,
      followers: currentUserId
        ? {
          where: { followerId: currentUserId },
          select: { followerId: true },
        }
        : false,
    },
  } as const;
}

function getProfileVotesInclude(currentUserId?: string) {
  return currentUserId
    ? {
      where: { userId: currentUserId },
      select: { userId: true, voteType: true },
    }
    : false;
}

function getProfileBookmarksInclude(currentUserId?: string) {
  return currentUserId
    ? {
      where: { userId: currentUserId },
      select: { id: true },
    }
    : false;
}

export async function getProfileSections(
  profileId: string,
  take: number = 1,
) {
  // The viewer is resolved server-side. This used to accept a client-supplied
  // `currentUserId` and filter each row's `votes` / `bookmarks` by it, which
  // let any caller read another user's vote and bookmark state.
  const viewer = await getCurrentUser();

  // ── Cached, viewer-agnostic rows + one live overlay statement ──
  // The 18 materialized counters and all 17 sections ride in the same cached
  // batch, so a warm tab costs exactly one query: the viewer overlay. The tab
  // used to cost two serialised round trips on every single visit.
  const { sections, counts } = await loadProfileContentTab({
    profileId,
    take,
    viewerId: viewer?.id ?? null,
  });

  return { id: profileId, ...sections, counts };
}

export async function getProfileSection(
  profileId: string,
  section: ProfileSection,
  skip: number = 0,
  take: number = 5,
) {
  // The viewer is resolved server-side; this used to accept a client-supplied
  // `currentUserId` and filter each row's `votes` / `bookmarks` by it.
  const viewer = await getCurrentUser();
  const currentUserId = viewer?.id;

  const model = PROFILE_SECTION_CONFIG[section].model;

  const include = {
    author: getProfileAuthorInclude(currentUserId),
    votes: getProfileVotesInclude(currentUserId),
    bookmarks: getProfileBookmarksInclude(currentUserId),
    ...(model === "recommendation"
      ? { supervisor: { select: { id: true, name: true } } }
      : {}),
    ...(model === "journalReview"
      ? { journal: { select: { id: true, title: true } } }
      : {}),
  };

  // `model` is a dynamic Prisma model key; a single intentional cast is used.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model].findMany({
    where: {
      authorId: profileId,
      isDeleted: false,
      ...(model === "recommendation" ? { isAnonymous: false } : {}),
      ...(model === "journalReview" ? { isAnonymous: false } : {}),
    },
    skip,
    take,
    // The `id` tiebreaker matches the ordering the tab's first page comes from
    // (see `buildContentSectionsSql`), so paging cannot skip or repeat a row
    // when two posts share a timestamp.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include,
  });
}

function getProfileParentWhere(section: ProfileSection, isBookmark = false) {
  const model = PROFILE_SECTION_CONFIG[section].model;
  return {
    isDeleted: false,
    ...(!isBookmark && model === "recommendation" ? { isAnonymous: false } : {}),
    ...(!isBookmark && model === "journalReview" ? { isAnonymous: false } : {}),
    ...(model === "contribution" ? { status: "APPROVED" } : {}),
  };
}

function getBookmarkParentInclude(section: ProfileSection, currentUserId?: string) {
  const model = PROFILE_SECTION_CONFIG[section].model;
  return {
    author: getProfileAuthorInclude(currentUserId),
    votes: getProfileVotesInclude(currentUserId),
    bookmarks: getProfileBookmarksInclude(currentUserId),
    ...(model === "recommendation"
      ? { supervisor: { select: { id: true, name: true } } }
      : {}),
    ...(model === "journalReview"
      ? { journal: { select: { id: true, title: true } } }
      : {}),
  };
}

type BookmarkDelegate = {
  count: (args: Record<string, unknown>) => Promise<number>;
  findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
};

function getBookmarkDelegate(bookmarkModel: string): BookmarkDelegate {
  return (prisma as unknown as Record<string, BookmarkDelegate>)[bookmarkModel];
}

export async function getProfileBookmarkSections(
  profileId: string,
  take: number = 1,
) {
  // Two things are resolved server-side here, both of which used to be
  // caller-controlled:
  //   1. the viewer, which decided whose vote / bookmark state was overlaid;
  //   2. *whose* bookmarks were listed. The tab is own-profile only, but that
  //      was enforced by the client, so the action itself would happily return
  //      any user's bookmarks to any caller.
  // Bookmarks are private, so the session decides both. `profileId` is still
  // returned for shape compatibility, but it is the viewer's own id.
  const viewer = await getCurrentUser();
  const ownerId = viewer?.id;
  if (!ownerId) {
    const empty = Object.fromEntries(
      (Object.keys(PROFILE_SECTION_CONFIG) as ProfileSection[]).map((s) => [
        s,
        [],
      ]),
    );
    return {
      id: profileId,
      ...empty,
      counts: Object.fromEntries(
        (Object.keys(PROFILE_SECTION_CONFIG) as ProfileSection[]).map((s) => [
          s,
          0,
        ]),
      ),
    } as NonNullable<Awaited<ReturnType<typeof getProfileSections>>>;
  }

  // One statement: 17 sections' rows and their totals together, instead of 34
  // serialised round trips. Cached under a per-user key, purged on bookmark.
  const { items, counts } = await loadProfileBookmarkTab({
    ownerId,
    take,
    viewerId: viewer.id,
  });

  return {
    id: profileId,
    ...items,
    counts,
  } as NonNullable<Awaited<ReturnType<typeof getProfileSections>>>;
}

export async function getProfileBookmarkSection(
  profileId: string,
  section: ProfileSection,
  skip: number = 0,
  take: number = 5,
) {
  // The viewer is resolved server-side; this used to accept a client-supplied
  // `currentUserId` and filter each row's `votes` / `bookmarks` by it.
  const viewer = await getCurrentUser();
  const currentUserId = viewer?.id;

  // Bookmarks are private, and the tab that calls this is own-profile only —
  // but that was a client-side check, so the action itself would return any
  // user's bookmarks to any caller. Scope the lookup to the session instead;
  // `profileId` is retained for signature compatibility and ignored.
  if (!currentUserId) return [];

  const config = PROFILE_SECTION_CONFIG[section];
  const bookmarkDelegate = getBookmarkDelegate(config.bookmarkModel);
  const rows = await bookmarkDelegate.findMany({
    where: {
      userId: currentUserId,
      [config.bookmarkParent]: getProfileParentWhere(section, true),
    },
    skip,
    take,
    // The `id` tiebreaker matches the ordering the tab's first page comes from
    // (see `buildBookmarkSectionsSql`), so paging cannot skip or repeat a row
    // when two bookmarks share a timestamp.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      [config.bookmarkParent]: {
        include: getBookmarkParentInclude(section, currentUserId),
      },
    },
  });

  return rows
    .map((row: Record<string, unknown>) => row[config.bookmarkParent])
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Activity tab: content the scholar commented on, replied to,
// and voted on. Returns a flat, unified list for rendering.
// ─────────────────────────────────────────────────────────────

export async function getProfileActivity(
  profileId: string,
  take = 10,
  cursor?: string,
) {
  if (!profileId) return [];

  return loadProfileActivity(profileId, take, cursor);
}

export async function updateProfile(formData: FormData) {
  const supabaseUser = await requireActiveUser(
    "You must be logged in to update your profile.",
  );

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
  });

  if (!user) {
    throw new Error("User not found in database.");
  }

  const newHandle = readOptionalFormValue(formData, "handle");
  const newName = readOptionalFormValue(formData, "name");
  const newBio = readOptionalFormValue(formData, "bio");
  assertRichTextWithinLimit(newBio ?? "", MAX_PROFILE_BIO, "Bio");
  const newAvatarUrl = readOptionalFormValue(formData, "avatarUrl");
  const newGithubUrl = readOptionalFormValue(formData, "githubUrl");
  const newOrcidUrl = readOptionalFormValue(formData, "orcidUrl");
  const newLinkedinUrl = readOptionalFormValue(formData, "linkedinUrl");
  const newGoogleScholarUrl = readOptionalFormValue(
    formData,
    "googleScholarUrl",
  );

  const safeGithubUrl = newGithubUrl === null ? null : newGithubUrl === "" ? null : validateExternalUrl(newGithubUrl, "GitHub URL");
  const safeOrcidUrl = newOrcidUrl === null ? null : newOrcidUrl === "" ? null : validateExternalUrl(newOrcidUrl, "ORCID URL");
  const safeLinkedinUrl = newLinkedinUrl === null ? null : newLinkedinUrl === "" ? null : validateExternalUrl(newLinkedinUrl, "LinkedIn URL");
  const safeGoogleScholarUrl = newGoogleScholarUrl === null ? null : newGoogleScholarUrl === "" ? null : validateExternalUrl(newGoogleScholarUrl, "Google Scholar URL");

  if (newHandle) {
    const handleAvailable = await isHandleAvailable(newHandle);
    if (!handleAvailable) {
      return {
        success: false,
        message: "Handle is already taken.",
      };
    }
  }

  const finalAvatarUrl = newAvatarUrl
    ? newAvatarUrl === user.avatarUrl
      ? newAvatarUrl
      : await promoteDraftCloudinaryAsset(newAvatarUrl, user.id, "avatar")
    : null;
  if (newAvatarUrl && !finalAvatarUrl) {
    throw new Error("Invalid avatar image.");
  }

  // Delete the previous avatar from Cloudinary when it is being replaced OR
  // explicitly removed (saved with no avatar).
  if (user.avatarUrl && finalAvatarUrl !== user.avatarUrl) {
    await deleteCloudinaryAsset(user.avatarUrl);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      // A handle is IDENTITY, and the edit form always submits the field, so a
      // blank input arrives as `""` (not `null`). Treating that like `null` and
      // passing it through `normalizeHandle` — which maps `""` to `null` — wrote
      // `handle: null`, silently destroying the user's @handle and breaking the
      // directory row plus every link that resolves it. Blank therefore means
      // "leave it alone", exactly like an absent field.
      handle:
        newHandle !== null && newHandle !== ""
          ? normalizeHandle(newHandle) ?? user.handle
          : user.handle,
      name: newName !== null ? newName : user.name,
      bio: newBio !== null ? newBio : user.bio,
      avatarUrl: finalAvatarUrl,
      githubUrl: newGithubUrl === null ? user.githubUrl : safeGithubUrl,
      orcidUrl: newOrcidUrl === null ? user.orcidUrl : safeOrcidUrl,
      linkedinUrl: newLinkedinUrl === null ? user.linkedinUrl : safeLinkedinUrl,
      googleScholarUrl: newGoogleScholarUrl === null ? user.googleScholarUrl : safeGoogleScholarUrl,
    },
  });

  // Name / handle / bio / avatar are part of the cached scholar directory, so a
  // profile edit must be visible there at once rather than after the TTL. The
  // edit also changes the author block embedded in the author's own cached
  // content, so their Content tab goes with it.
  revalidateContent("SCHOLAR_DIRECTORY", user.id);

  return {
    success: true,
    message: "Your profile has been updated successfully!",
  };
}

export async function isHandleAvailable(handle: string) {
  const supabaseUser = await requireActiveUser(
    "You must be logged in to check handle availability.",
  );
  const normalizedHandle = normalizeHandle(handle);
  const user = await prisma.user.findFirst({
    where: {
      handle: normalizedHandle,
      id: {
        not: supabaseUser.id,
      },
    },
  });

  return !user;
}
