"use server";

import { cache } from "react";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { normalizeHandle, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import {
  deleteCloudinaryAsset,
  promoteDraftCloudinaryAsset,
} from "@/lib/cloudinary";
import { MAX_PROFILE_BIO } from "@/lib/constants";
import { validateExternalUrl } from "@/lib/external-url";
import {
  PROFILE_SECTION_CONFIG,
  type ProfileSection,
} from "@/lib/module-registry";

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
  currentUserId?: string,
  take: number = 1,
) {
  // ── Task 2.1: Fetch all 16 materialized counters in a single query ──
  const userCounters = await prisma.user.findUnique({
    where: { id: profileId },
    select: {
      articleCount: true,
      socialPostCount: true,
      jobVacancyCount: true,
      phdAdmissionCount: true,
      researchEventCount: true,
      helpPostCount: true,
      journalCount: true,
      journalReviewCount: true,
      researchToolCount: true,
      recommendationCount: true,
      supervisorCount: true,
      resultCount: true,
      contributionCount: true,
      publicationCount: true,
      surveyCount: true,
      surveyParticipationCount: true,
      researchGrantCount: true,
      courseCount: true,
    },
  });

  const authorSelect = getProfileAuthorInclude(currentUserId);
  const votesSelect = getProfileVotesInclude(currentUserId);
  const bookmarksSelect = getProfileBookmarksInclude(currentUserId);

  const [
    articles,
    socialPosts,
    vacancies,
    admissions,
    events,
    helpPosts,
    journals,
    researchTools,
    recommendations,
    supervisors,
    results,
    contributionPosts,
    publications,
    surveys,
    researchGrants,
    courses,
    journalReviews,
  ] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.socialPost.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.jobVacancy.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.phdAdmission.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.researchEvent.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.helpPost.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.journal.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.researchTool.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.recommendation.findMany({
      where: { authorId: profileId, isDeleted: false, isAnonymous: false },
      take,
      orderBy: { createdAt: "desc" },
      include: {
        author: authorSelect,
        votes: votesSelect,
        bookmarks: bookmarksSelect,
        supervisor: { select: { id: true, name: true } },
      },
    }),
    prisma.supervisor.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.result.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.contribution.findMany({
      where: { authorId: profileId, isDeleted: false, status: "APPROVED" },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.publication.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.researchSurvey.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.researchGrant.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    prisma.course.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect, bookmarks: bookmarksSelect },
    }),
    // Anonymous reviews stay hidden from the public profile, exactly like
    // anonymous recommendations (the materialized counter is also skipped).
    prisma.journalReview.findMany({
      where: { authorId: profileId, isDeleted: false, isAnonymous: false },
      take,
      orderBy: { createdAt: "desc" },
      include: {
        author: authorSelect,
        votes: votesSelect,
        bookmarks: bookmarksSelect,
        journal: { select: { id: true, title: true } },
      },
    }),
  ]);

  return {
    id: profileId,
    articles,
    socialPosts,
    vacancies,
    admissions,
    events,
    helpPosts,
    journals,
    researchTools,
    recommendations,
    supervisors,
    results,
    contributionPosts,
    publications,
    surveys,
    researchGrants,
    courses,
    journalReviews,
    counts: {
      articles: userCounters?.articleCount ?? 0,
      socialPosts: userCounters?.socialPostCount ?? 0,
      vacancies: userCounters?.jobVacancyCount ?? 0,
      admissions: userCounters?.phdAdmissionCount ?? 0,
      events: userCounters?.researchEventCount ?? 0,
      helpPosts: userCounters?.helpPostCount ?? 0,
      journals: userCounters?.journalCount ?? 0,
      researchTools: userCounters?.researchToolCount ?? 0,
      recommendations: userCounters?.recommendationCount ?? 0,
      supervisors: userCounters?.supervisorCount ?? 0,
      results: userCounters?.resultCount ?? 0,
      contributionPosts: userCounters?.contributionCount ?? 0,
      publications: userCounters?.publicationCount ?? 0,
      surveys: userCounters?.surveyCount ?? 0,
      surveyParticipation: userCounters?.surveyParticipationCount ?? 0,
      researchGrants: userCounters?.researchGrantCount ?? 0,
      courses: userCounters?.courseCount ?? 0,
      journalReviews: userCounters?.journalReviewCount ?? 0,
    },
  };
}

export async function getProfileSection(
  profileId: string,
  section: ProfileSection,
  currentUserId?: string,
  skip: number = 0,
  take: number = 5,
) {
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
    orderBy: { createdAt: "desc" },
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
  currentUserId?: string,
  take: number = 1,
) {
  const entries = Object.entries(PROFILE_SECTION_CONFIG) as Array<
    [ProfileSection, (typeof PROFILE_SECTION_CONFIG)[ProfileSection]]
  >;

  const countEntries = await Promise.all(
    entries.map(async ([section, config]) => {
      const bookmarkDelegate = getBookmarkDelegate(config.bookmarkModel);
      const count = await bookmarkDelegate.count({
        where: {
          userId: profileId,
          [config.bookmarkParent]: getProfileParentWhere(section, true),
        },
      });
      return [section, count] as const;
    }),
  );

  const itemEntries = await Promise.all(
    entries.map(async ([section, config]) => {
      const bookmarkDelegate = getBookmarkDelegate(config.bookmarkModel);
      const rows = await bookmarkDelegate.findMany({
        where: {
          userId: profileId,
          [config.bookmarkParent]: getProfileParentWhere(section, true),
        },
        take,
        orderBy: { createdAt: "desc" },
        include: {
          [config.bookmarkParent]: {
            include: getBookmarkParentInclude(section, currentUserId),
          },
        },
      });
      return [
        section,
        rows
          .map((row: Record<string, unknown>) => row[config.bookmarkParent])
          .filter(Boolean),
      ] as const;
    }),
  );

  return {
    id: profileId,
    ...Object.fromEntries(itemEntries),
    counts: Object.fromEntries(countEntries),
  } as NonNullable<Awaited<ReturnType<typeof getProfileSections>>>;
}

export async function getProfileBookmarkSection(
  profileId: string,
  section: ProfileSection,
  currentUserId?: string,
  skip: number = 0,
  take: number = 5,
) {
  const config = PROFILE_SECTION_CONFIG[section];
  const bookmarkDelegate = getBookmarkDelegate(config.bookmarkModel);
  const rows = await bookmarkDelegate.findMany({
    where: {
      userId: profileId,
      [config.bookmarkParent]: getProfileParentWhere(section, true),
    },
    skip,
    take,
    orderBy: { createdAt: "desc" },
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

  return prisma.userActivity.findMany({
    where: { userId: profileId },
    take,
    orderBy: { createdAt: "desc" },
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true,
      action: true,
      moduleType: true,
      entityId: true,
      entityTitle: true,
      createdAt: true,
    },
  });
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
      handle: newHandle !== null ? normalizeHandle(newHandle) : user.handle,
      name: newName !== null ? newName : user.name,
      bio: newBio !== null ? newBio : user.bio,
      avatarUrl: finalAvatarUrl,
      githubUrl: newGithubUrl === null ? user.githubUrl : safeGithubUrl,
      orcidUrl: newOrcidUrl === null ? user.orcidUrl : safeOrcidUrl,
      linkedinUrl: newLinkedinUrl === null ? user.linkedinUrl : safeLinkedinUrl,
      googleScholarUrl: newGoogleScholarUrl === null ? user.googleScholarUrl : safeGoogleScholarUrl,
    },
  });

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
