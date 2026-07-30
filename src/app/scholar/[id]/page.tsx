import { createClient } from "@/utils/supabase/server";
import { FollowButton } from "@/components/interactions/FollowButton";
import { ShareButton } from "@/components/interactions/ShareButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getProfile } from "@/app/actions/profile";
import ProfileTabs from "@/components/profile/ProfileTabs";
import { FollowerCount } from "./FollowerCount";

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
    <main className="mx-auto max-w-5xl py-6 px-4">
      {/* Profile Header */}
      <div className="mb-10 flex flex-col gap-6 border-b border-slate-200 pb-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          {/* Avatar Placeholder / Image */}
          <div className="w-24 h-24 rounded-full bg-slate-200 border-2 border-white shadow-md flex items-center justify-center overflow-hidden shrink-0">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name || "User"}
                width={96}
                height={96}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-slate-400">
                {profile.name?.charAt(0).toUpperCase() || "S"}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {profile.name}
            </h1>
            <p className="font-medium text-blue-700">
              {profile.handle ? `@${profile.handle}` : "No handle set"}
            </p>
            <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
              <FollowerCount
                followerCount={profile._count.followers}
                followingCount={profile._count.following}
                profileId={profile.id}
                currentUserId={currentUser?.id}
              />
              <span className="inline-flex items-center gap-1">
                <svg
                  className="h-3.5 w-3.5 text-amber-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {profile.reputation} reputation
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <ShareButton label="Share profile" href={`/scholar/${profile.id}`} />
          {isOwnProfile ? (
            <Link
              href={`/scholar/${profile.id}/settings`}
              className="sb-button-soft"
            >
              Edit Profile
            </Link>
          ) : (
            <FollowButton targetId={profile.id} isFollowing={isFollowing} />
          )}
        </div>
      </div>

      {/* Profile Tabs (About + Content) */}
      <ProfileTabs
        profile={{
          id: profile.id,
          name: profile.name,
          handle: profile.handle,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
        }}
        profileId={profile.id}
        currentUserId={currentUser?.id}
      />
    </main>
  );
}
