"use server";

import { cache } from "react";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { normalizeHandle, readOptionalFormValue, assertRichTextWithinLimit } from "@/lib/form";
import { deleteFromCloudinary } from "@/app/actions/cloudinary";
import { MAX_PROFILE_BIO } from "@/lib/constants";

export const getProfile = cache(
  async (profileId: string, currentUserId?: string) => {
    const userWithProfileData = await prisma.user.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        name: true,
        handle: true,
        avatarUrl: true,
        bio: true,
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

  const authorSelect = {
    select: {
      id: true,
      name: true,
      handle: true,
      avatarUrl: true,
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
  };

  const votesSelect = currentUserId
    ? {
      where: { userId: currentUserId },
      select: { userId: true, voteType: true },
    }
    : false;

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
  ] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.socialPost.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.jobVacancy.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.phdAdmission.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.researchEvent.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.helpPost.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.journal.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.researchTool.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.recommendation.findMany({
      where: { authorId: profileId, isDeleted: false, isAnonymous: false },
      take,
      orderBy: { createdAt: "desc" },
      include: {
        author: authorSelect,
        votes: votesSelect,
        supervisor: { select: { id: true, name: true } },
      },
    }),
    prisma.supervisor.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.result.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.contribution.findMany({
      where: { authorId: profileId, isDeleted: false, status: "APPROVED" },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.publication.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.researchSurvey.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.researchGrant.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
    }),
    prisma.course.findMany({
      where: { authorId: profileId, isDeleted: false },
      take,
      orderBy: { createdAt: "desc" },
      include: { author: authorSelect, votes: votesSelect },
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
    },
  };
}

const ProfileSectionMap = {
  articles: "article",
  socialPosts: "socialPost",
  vacancies: "jobVacancy",
  admissions: "phdAdmission",
  events: "researchEvent",
  helpPosts: "helpPost",
  journals: "journal",
  researchTools: "researchTool",
  recommendations: "recommendation",
  supervisors: "supervisor",
  results: "result",
  contributionPosts: "contribution",
  publications: "publication",
  surveys: "researchSurvey",
  researchGrants: "researchGrant",
  courses: "course",
} as const;

export async function getProfileSection(
  profileId: string,
  section: keyof typeof ProfileSectionMap,
  currentUserId?: string,
  skip: number = 0,
  take: number = 5,
) {
  const model = ProfileSectionMap[section];
  if (!model) throw new Error(`Invalid section: ${section}`);

  const include = {
    author: {
      select: {
        id: true,
        name: true,
        handle: true,
        avatarUrl: true,
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
    },
    votes: currentUserId
      ? {
        where: { userId: currentUserId },
        select: { userId: true, voteType: true },
      }
      : false,
    ...(model === "recommendation"
      ? { supervisor: { select: { id: true, name: true } } }
      : {}),
  };

  // `model` is a dynamic Prisma model key; a single intentional cast is used.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model].findMany({
    where: {
      authorId: profileId,
      isDeleted: false,
      ...(model === "recommendation" ? { isAnonymous: false } : {}),
    },
    skip,
    take,
    orderBy: { createdAt: "desc" },
    include,
  });
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

  if (newHandle) {
    const handleAvailable = await isHandleAvailable(newHandle);
    if (!handleAvailable) {
      return {
        success: false,
        message: "Handle is already taken.",
      };
    }
  }

  // Delete old avatar from Cloudinary if a new one is being set
  if (newAvatarUrl && newAvatarUrl !== user.avatarUrl && user.avatarUrl) {
    await deleteFromCloudinary(user.avatarUrl);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      handle: newHandle ? normalizeHandle(newHandle) : user.handle,
      name: newName || user.name,
      bio: newBio,
      avatarUrl: newAvatarUrl ?? user.avatarUrl,
      githubUrl: newGithubUrl ?? user.githubUrl,
      orcidUrl: newOrcidUrl ?? user.orcidUrl,
      linkedinUrl: newLinkedinUrl ?? user.linkedinUrl,
      googleScholarUrl: newGoogleScholarUrl ?? user.googleScholarUrl,
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
