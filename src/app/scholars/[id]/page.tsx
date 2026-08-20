import { createClient } from "@/utils/supabase/server";
import { FollowButton } from "@/components/interactions/FollowButton";
import { ShareButton } from "@/components/interactions/ShareButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ProfileTabs from "@/components/profile/ProfileTabs";
import { MessageButton } from "@/components/interactions/MessageButton";
import { Star } from "lucide-react";
import { FollowerCount } from "./FollowerCount";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getProfile } from "@/app/actions/profile";
import { formatTimeAgo } from "@/utils/time-ago";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id).catch(() => null);
  if (!profile) return { title: "Scholar Profile" };
  return buildMetadata({
    title: `${profile.name || "Scholar"}${profile.handle ? ` (@${profile.handle})` : ""}`,
    description: profile.bio || `${profile.name || "Scholar"} on ScholarBase`,
    path: `/scholars/${profile.id}`,
    type: "profile",
  });
}

export default async function ScholarProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const profile = await getProfile(id, currentUser?.id);

  if (!profile) notFound();

  const { isFollowing, isOwnProfile } = profile;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-10 flex flex-col gap-6 border-b border-slate-200 pb-10 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-md dark:border-slate-950 dark:bg-slate-800">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name || "User"}
                width={96}
                height={96}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-slate-400 dark:text-slate-500">
                {profile.name?.charAt(0).toUpperCase() || "S"}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              {profile.name}
            </h1>
            <p className="font-medium text-blue-700 dark:text-blue-300">
              {profile.handle ? `@${profile.handle}` : "No handle set"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <FollowerCount
                followerCount={profile.followersCount}
                followingCount={profile.followingCount}
                profileId={profile.id}
                currentUserId={currentUser?.id}
              />
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                {profile.reputation} reputation
              </span>
              <span suppressHydrationWarning>Joined {formatTimeAgo(profile.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <ShareButton label="Share profile" href={`/scholars/${profile.id}`} />
          {isOwnProfile ? (
            <Link
              href={`/scholars/${profile.id}/settings`}
              className="sb-button-soft"
            >
              Edit Profile
            </Link>
          ) : (
            <>
              <MessageButton
                recipientId={profile.id}
                recipientName={profile.name}
              />
              <FollowButton targetId={profile.id} isFollowing={isFollowing} />
            </>
          )}
        </div>
      </div>

      <ProfileTabs
        profile={{
          id: profile.id,
          name: profile.name,
          handle: profile.handle,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          githubUrl: profile.githubUrl,
          orcidUrl: profile.orcidUrl,
          linkedinUrl: profile.linkedinUrl,
          googleScholarUrl: profile.googleScholarUrl,
        }}
        profileId={profile.id}
        currentUserId={currentUser?.id}
      />
    </main>
  );
}
