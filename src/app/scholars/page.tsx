import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Scholars',
  description: 'Discover, search, and connect with scholars by reputation, expertise, and activity.',
  path: '/scholars',
  section: 'Scholars',
})
import ListPageShell from '@/components/layout/ListPageShell'
import { getCurrentUser } from '@/lib/auth'
import { getScholars } from '@/app/actions/scholars'
import { ScholarsList } from '@/components/scholars/ScholarsList'
import { getTrendingScholars } from '@/lib/trending'
import { TrendingList } from '@/components/feed/TrendingList'
import { ShareButton } from '@/components/interactions/ShareButton'
import { AsyncListRegion } from '@/components/cards/AsyncListRegion'

export default async function ScholarsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; sort?: string }>
}) {
  const { q, tab, sort } = await searchParams as { q?: string; tab?: string; sort?: string }
  const pageSize = 10
  // Auth resolved lazily so the shell heading/tabs render instantly while the
  // list region suspends via AsyncListRegion.
  const userPromise = getCurrentUser()

  return (
    <ListPageShell
      title="Find Scholars"
      description="Search researchers, collaborators, and peers across the community."
      addAction={
        <ShareButton
          href="/"
          label="Share ScholarBase"
          variant="primary"
          copySuccessMessage="ScholarBase link copied"
        />
      }
      tab={tab}
      enableTrending={true}
      allHref="/scholars"
      trendingHref="/scholars?tab=trending"
      trending={
        <AsyncListRegion
          fetcher={async () => {
            const currentUser = await userPromise
            const items = (await getTrendingScholars(currentUser?.id)) as unknown as import('@/types/trending').TrendingItem[]
            return { items, userId: currentUser?.id }
          }}
        >
          {({ items, userId }) => (
            <TrendingList items={items} currentUserId={userId ?? ''} />
          )}
        </AsyncListRegion>
      }
      all={
        <AsyncListRegion
          key={q}
          fetcher={async () => {
            const currentUser = await userPromise
            const scholars = await getScholars(
              q,
              sort === 'reputation' ? 'reputation' : 'latest',
              currentUser?.id,
              pageSize,
            )
            return { scholars, userId: currentUser?.id }
          }}
        >
          {({ scholars, userId }) => (
            <ScholarsList
              scholars={scholars}
              currentUserId={userId ?? ''}
              initialQuery={q ?? ''}
              loadMoreParams={{ q, sort }}
            />
          )}
        </AsyncListRegion>
      }
    />
  );
}
