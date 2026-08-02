import type { Metadata } from 'next'
import Link from 'next/link'
import { inviteScholar } from '@/app/actions/scholars'

export const metadata: Metadata = {
  title: 'Invite Scholar',
  description: 'Invite a scholar to join ScholarBase and collaborate on research.',
  robots: { index: false, follow: true },
}

export default async function InviteScholarPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams

  return (
    <main className="mx-auto max-w-3xl py-6">
      <div className="mb-8">
        <Link href="/scholars" className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700">
          ← Back to Scholars
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Invite Scholar</h1>
        <p className="mt-2 text-slate-600">Send a collaboration invite to a scholar who is not on ScholarBase yet.</p>
        {message ? <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      </div>

      <form action={inviteScholar} className="space-y-5 sb-card p-6 md:p-8">
        <div>
          <label className="sb-label" htmlFor="name">Name</label>
          <input id="name" name="name" className="sb-input" placeholder="Scholar name" />
        </div>
        <div>
          <label className="sb-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="sb-input" placeholder="scholar@university.edu" required />
        </div>
        <div>
          <label className="sb-label" htmlFor="message">Message</label>
          <textarea id="message" name="message" className="sb-textarea min-h-40" placeholder="Tell them why they should join ScholarBase." required />
        </div>
        <button type="submit" className="sb-button-primary">Send invite</button>
      </form>
    </main>
  )
}