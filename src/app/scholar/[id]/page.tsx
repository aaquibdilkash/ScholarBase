import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";
import { FollowButton } from "@/components/interactions/FollowButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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

  const profile = await prisma.user.findUnique({
    where: { id },
    include: {
      articles: true,
      socialPosts: true,
      followers: true,
    },
  });

  if (!profile) notFound();

  const isFollowing = currentUser
    ? profile.followers.some((f) => f.followerId === currentUser.id)
    : false;

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <main className="mx-auto max-w-4xl py-6">
      {/* Profile Header */}
      <div className="mb-10 flex flex-col gap-6 border-b border-slate-200 pb-10 md:flex-row md:items-center md:justify-between">
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
            <p className="mb-1 font-medium text-blue-700">
              {profile.handle ? `@${profile.handle}` : "No handle set"}
            </p>
            <p className="text-sm text-slate-500">
              {profile.followers.length} followers
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {isOwnProfile ? (
            <Link
              href={`/scholar/${profile.id}/settings`}
              className="sb-button-soft"
            >
              Edit Profile
            </Link>
          ) : (
            currentUser && (
              <FollowButton targetId={profile.id} isFollowing={isFollowing} />
            )
          )}
        </div>
      </div>

      {/* Bio Section */}
      {profile.bio && (
        <div className="mb-12">
          <h2 className="mb-2 text-lg font-semibold text-slate-950">About</h2>
          <p className="sb-card leading-relaxed text-slate-700">
            {profile.bio}
          </p>
        </div>
      )}

      {/* Content Tabs / Sections */}
      <div className="space-y-12">
        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Research Articles
          </h2>
          {profile.articles.length > 0 ? (
            <div className="space-y-4">
              {profile.articles.map((a) => (
                <Link
                  href={`/blog/${a.slug}`}
                  key={a.id}
                  className="sb-card sb-card-hover group block"
                >
                  <h3 className="text-lg font-semibold text-slate-950 transition-colors group-hover:text-blue-700">
                    {a.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {a.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No articles published yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Feed Posts
          </h2>
          <div className="space-y-4">
            {profile.socialPosts.map((p) => (
              <Link
                href={`/feed/${p.id}`}
                key={p.id}
                className="sb-card sb-card-hover group block"
              >
                <p className="line-clamp-3 whitespace-pre-wrap text-slate-800">
                  {p.content}
                </p>
                <p className="mt-3 text-xs font-medium text-slate-400 transition-colors group-hover:text-blue-700">
                  View post & comments →
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
