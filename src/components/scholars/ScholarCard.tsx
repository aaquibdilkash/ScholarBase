import { RichContent } from "@/components/content/RichContent";
import Link from "next/link";
import ListPageCardShell from "@/components/cards/ListPageCardShell";
import { ShareButton } from "@/components/interactions/ShareButton";
import { ReportMenu } from "@/components/cards/ReportMenu";

type ScholarCardProps = {
  scholar: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
    bio: string | null;
    reputation: number;
    createdAt: Date;
    followers?: { followerId: string }[];
    // RULE 6: materialized counters maintained in transactions.ts (handleFollow).
    followersCount: number;
    followingCount: number;
  };
  currentUserId?: string;
};

export function ScholarCard({ scholar, currentUserId }: ScholarCardProps) {
  const isFollowing = (scholar.followers?.length ?? 0) > 0;

  return (
    <ListPageCardShell
      authorHref={`/scholars/${scholar.id}`}
      authorName={scholar.name || "Scholar"}
      authorHandle={scholar.handle || undefined}
      authorAvatarUrl={scholar.avatarUrl || undefined}
      authorId={scholar.id}
      isFollowing={isFollowing}
      currentUserId={currentUserId}
      detailPageHref={`/scholars/${scholar.id}`}
      createdDate={scholar.createdAt}
      createdLabel="Joined"
      noBodyLink={true}
      bodyBottomContent={
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span>{scholar.followersCount ?? 0} followers</span>
          <span>{scholar.followingCount ?? 0} following</span>
        </div>
      }
      footer={
        <div className="mt-4 flex w-full min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-3">
            <Link
              href={`/scholars/${scholar.id}`}
              className="min-w-0 flex-1 truncate rounded-lg bg-slate-950 px-2 py-2 text-center text-xs font-semibold text-white transition hover:bg-slate-800 sm:flex-none sm:px-6 sm:text-sm"
            >
              View profile
            </Link>
            {currentUserId && currentUserId !== scholar.id ? (
              <Link
                href={`/messages/new?to=${scholar.id}`}
                className="min-w-0 flex-1 truncate rounded-lg bg-slate-950 px-2 py-2 text-center text-xs font-semibold text-white transition hover:bg-slate-800 sm:flex-none sm:px-6 sm:text-sm"
              >
                Message
              </Link>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ShareButton href={`/scholars/${scholar.id}`} />
            {scholar.id !== currentUserId ? (
              <ReportMenu
                entityId={scholar.id}
                entityType="POST"
                module="SCHOLAR_PROFILE"
                ownerId={scholar.id}
                currentUserId={currentUserId ?? null}
                reportLabel="Report User"
              />
            ) : null}
          </div>
        </div>
      }
    >
      <Link href={`/scholars/${scholar.id}`} className="block group">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {scholar.bio ? (
              <RichContent
                content={scholar.bio}
                className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
              />
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No bio added yet.
              </p>
            )}
          </div>
          <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
            {scholar.reputation} rep
          </div>
        </div>
      </Link>
    </ListPageCardShell>
  );
}
