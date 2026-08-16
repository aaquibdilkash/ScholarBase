import type { Metadata } from 'next'
import ListPageShell from '@/components/layout/ListPageShell'
import { getCurrentUser } from '@/lib/auth'
import { getScholars } from '@/app/actions/scholars'
import { ScholarsList } from '@/components/scholars/ScholarsList'
import { getTrendingScholars } from '@/lib/trending'
import { TrendingList } from '@/components/feed/TrendingList'
import { TrendingItem } from '@/types/trending'

export const metadata: Metadata = {
  title: 'Scholars',
  description: 'Discover, search, and connect with scholars by reputation, expertise, and activity.',
  alternates: {
    canonical: 'https://scholarbase.app/scholars',
  },
  robots: { index: true, follow: true },
}

export default async function ScholarsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; sort?: string }>
}) {
  const { q, tab, sort } = await searchParams as { q?: string; tab?: string; sort?: string }
  const isTrendingTab = tab === 'trending'
  const currentUser = await getCurrentUser()
  const pageSize = 10

  const scholars = isTrendingTab ? [] : await getScholars(
    q,
    sort === 'reputation' ? 'reputation' : 'latest',
    currentUser?.id,
    pageSize,
  );

  const trendingItems = (isTrendingTab
    ? await getTrendingScholars(currentUser?.id)
    : []) as unknown as TrendingItem[];

  return (
    <ListPageShell
      title="Find Scholars"
      description="Search researchers, collaborators, and peers across the community."
      addHref="/scholars/invite"
      addLabel="Invite scholar"
      tab={tab}
      enableTrending={true}
      allHref="/scholars"
      trendingHref="/scholars?tab=trending"
      trending={
        <TrendingList
          items={trendingItems}
          currentUserId={currentUser?.id}
        />
      }
      all={
        <ScholarsList
          scholars={scholars}
          currentUserId={currentUser?.id}
          initialQuery={q ?? ''}
          loadMoreParams={!isTrendingTab ? { q, sort } : undefined}
        />
      }
    />
  );
}
