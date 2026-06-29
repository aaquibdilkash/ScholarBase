import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";
import { FollowButton } from "@/components/interactions/FollowButton";
import { notFound } from "next/navigation";

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

  // Check if current user is in the followers list of this profile
  const isFollowing = currentUser
    ? profile.followers.some((f) => f.followerId === currentUser.id)
    : false;

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8 border-b pb-8">
        <div>
          <h1 className="text-3xl font-bold">{profile.name}</h1>
          <p className="text-gray-500">{profile.followers.length} followers</p>
        </div>

        {currentUser && currentUser.id !== profile.id && (
          <FollowButton targetId={profile.id} isFollowing={isFollowing} />
        )}
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-xl font-bold mb-4">Articles</h2>
          {profile.articles.length > 0 ? (
            <div className="space-y-4">
              {profile.articles.map((a) => (
                <div
                  key={a.id}
                  className="p-4 border rounded-xl hover:shadow-sm transition"
                >
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="text-sm text-gray-600">{a.excerpt}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No articles published yet.</p>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Feed Posts</h2>
          <div className="space-y-4">
            {profile.socialPosts.map((p) => (
              <div key={p.id} className="p-4 border rounded-xl">
                <p>{p.content}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
