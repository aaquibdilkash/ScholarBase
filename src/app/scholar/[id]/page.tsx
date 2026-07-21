import { createClient } from "@/utils/supabase/server";
import { FollowButton } from "@/components/interactions/FollowButton";
import { ShareButton } from "@/components/interactions/ShareButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getProfile } from "@/app/actions/profile";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { SocialPostCard } from "@/components/feed/SocialPostCard";
import { VacancyCard } from "@/components/vacancies/VacancyCard";
import { AdmissionCard } from "@/components/admissions/AdmissionCard";
import { EventCard } from "@/components/events/EventCard";
import { HelpPostCard } from "@/components/help/HelpPostCard";
import { JournalCard } from "@/components/journals/JournalCard";
import { ResearchToolCard } from "@/components/research-tools/ResearchToolCard";
import { RecommendationCard } from "@/components/supervisor/RecommendationCard";
import { SupervisorCard } from "@/components/supervisor/SupervisorCard";

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
            <p className="mt-1 text-sm text-slate-500">
              {profile._count.followers}{" "}
              {profile._count.followers === 1 ? "follower" : "followers"}
            </p>
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
          <p className="sb-card leading-relaxed text-slate-700 p-4">
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
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.articles.map((a) => (
                <div key={a.id} className="flex-shrink-0 w-full snap-center">
                  <ArticleCard article={a} currentUserId={currentUser?.id} />
                </div>
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
          {profile.socialPosts.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.socialPosts.map((p) => (
                <div key={p.id} className="flex-shrink-0 w-full snap-center">
                  <SocialPostCard
                    post={p}
                    isLiked={p.likes.some((l) => l.userId === currentUser?.id)}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No feed posts yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Job Vacancies
          </h2>
          {profile.vacancies.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.vacancies.map((v) => (
                <div key={v.id} className="flex-shrink-0 w-full snap-center">
                  <VacancyCard
                    vacancy={{
                      ...v,
                      isLiked: v.likes.some(
                        (l) => l.userId === currentUser?.id,
                      ),
                    }}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No job vacancies posted yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            PhD Admissions
          </h2>
          {profile.admissions.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.admissions.map((a) => (
                <div key={a.id} className="flex-shrink-0 w-full snap-center">
                  <AdmissionCard
                    admission={{
                      ...a,
                      isLiked: a.likes.some(
                        (l) => l.userId === currentUser?.id,
                      ),
                    }}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No PhD admissions posted yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Research Events
          </h2>
          {profile.events.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.events.map((e) => (
                <div key={e.id} className="flex-shrink-0 w-full snap-center">
                  <EventCard
                    event={{
                      ...e,
                      isLiked: e.likes.some(
                        (l) => l.userId === currentUser?.id,
                      ),
                    }}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No research events posted yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Help Posts
          </h2>
          {profile.helpPosts.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.helpPosts.map((h) => (
                <div key={h.id} className="flex-shrink-0 w-full snap-center">
                  <HelpPostCard
                    helpPost={{
                      ...h,
                      isLiked: currentUser?.id
                        ? h.likes.some((l) => l.userId === currentUser.id)
                        : false,
                    }}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No help posts yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Journals
          </h2>
          {profile.journals.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.journals.map((j) => (
                <div key={j.id} className="flex-shrink-0 w-full snap-center">
                  <JournalCard
                    journal={{
                      ...j,
                      isLiked: j.likes.some(
                        (l) => l.userId === currentUser?.id,
                      ),
                    }}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No journals posted yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Research Tools
          </h2>
          {profile.researchTools.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.researchTools.map((r) => (
                <div key={r.id} className="flex-shrink-0 w-full snap-center">
                  <ResearchToolCard
                    tool={{
                      ...r,
                      isLiked: r.likes.some(
                        (l) => l.userId === currentUser?.id,
                      ),
                    }}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No research tools posted yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Recommendations Given
          </h2>
          {profile.recommendations.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.recommendations.map((r) => (
                <div key={r.id} className="flex-shrink-0 w-full snap-center">
                  <RecommendationCard
                    recommendation={r}
                    supervisor={r.supervisor}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No recommendations given yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Supervisor Profiles
          </h2>
          {profile.supervisors.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
              {profile.supervisors.map((s) => (
                <div key={s.id} className="flex-shrink-0 w-full snap-center">
                  <SupervisorCard
                    supervisor={{ ...s, recommendations: [] }}
                    currentUserId={currentUser?.id}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 p-6 text-center italic text-slate-500">
              No supervisor profiles created yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
