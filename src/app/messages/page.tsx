import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getInbox } from '@/app/actions/messages'
import { formatTimeAgo } from '@/utils/time-ago'

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Direct conversations with fellow scholars for collaboration and research.',
  robots: { index: false, follow: true },
}

export default async function MessagesPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-500">
          Select a conversation
        </h2>
        <p className="mt-2 text-slate-400">
          Choose a conversation from the sidebar to start chatting.
        </p>
      </div>
    </div>
  );
}