import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";
import { FollowButton } from "@/components/interactions/FollowButton";
import { notFound } from "next/navigation";
import Link from "next/link";
// import Image from "next/image"; // Commented out until you implement file uploads

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
    <main className="max-w-3xl mx-auto py-12 px-4">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b pb-10">
        <div className="flex items-center gap-6">
          {/* Avatar Placeholder / Image */}
          <div className="w-24 h-24 rounded-full bg-slate-200 border-2 border-white shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-slate-400">
                {profile.name?.charAt(0).toUpperCase() || "S"}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {profile.name}
            </h1>
            <p className="text-blue-600 font-medium mb-1">
              {profile.handle ? `@${profile.handle}` : "No handle set"}
            </p>
            <p className="text-slate-500 text-sm">
              {profile.followers.length} followers
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {isOwnProfile ? (
            <Link
              href="/settings/profile"
              className="px-5 py-2 text-sm font-semibold border border-slate-300 rounded-xl hover:bg-slate-50 transition"
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
          <h2 className="text-lg font-bold text-slate-900 mb-2">About</h2>
          <p className="text-slate-700 leading-relaxed bg-white p-5 rounded-xl border shadow-sm">
            {profile.bio}
          </p>
        </div>
      )}

      {/* Content Tabs / Sections */}
      <div className="space-y-12">
        <section>
          <h2 className="text-xl font-bold mb-4 text-slate-900">
            Research Articles
          </h2>
          {profile.articles.length > 0 ? (
            <div className="space-y-4">
              {profile.articles.map((a) => (
                <Link
                  href={`/blog/${a.slug}`}
                  key={a.id}
                  className="block p-5 border rounded-xl bg-white hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                >
                  <h3 className="font-semibold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                    {a.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 line-clamp-2">{a.excerpt}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 italic bg-slate-50 p-6 rounded-xl text-center border border-dashed">
              No articles published yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4 text-slate-900">Feed Posts</h2>
          <div className="space-y-4">
            {profile.socialPosts.map((p) => (
              <Link
                href={`/feed/${p.id}`}
                key={p.id}
                className="block p-5 border rounded-xl bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <p className="text-slate-800 whitespace-pre-wrap line-clamp-3">
                  {p.content}
                </p>
                <p className="text-xs text-slate-400 mt-3 font-medium group-hover:text-blue-500 transition-colors">
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