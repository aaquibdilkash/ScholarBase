'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { findDirectConversation } from '@/app/actions/messages'
import { getScholarById } from '@/app/actions/scholars'
import { supabase } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { NewMessageForm } from '@/components/messages/NewMessageForm'
import { NewGroupForm } from '@/components/messages/NewGroupForm'
import { useToast } from '@/components/ui/Toast'
import CreateOrEditPageShell from '@/components/layout/CreateOrEditPageShell'
import Link from 'next/link'

type Scholar = NonNullable<Awaited<ReturnType<typeof getScholarById>>>

function NewConversationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const recipientId = searchParams.get('to')
  const isGroup = searchParams.get('group') === '1'
  const contextType = searchParams.get('contextType') ?? undefined
  const contextId = searchParams.get('contextId') ?? undefined
  const groupTitle = searchParams.get('title') ?? undefined
  const [user, setUser] = useState<User | null>(null)
  const [recipient, setRecipient] = useState<Scholar | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (user && recipientId) {
      if (user.id === recipientId) {
        toast("You cannot start a conversation with yourself.", "error");
        router.replace('/messages')
        return
      }
      
      const checkConversation = async () => {
        setLoading(true);
        const conversationId = await findDirectConversation(recipientId)
        if (conversationId) {
          router.replace(`/messages/${conversationId}`)
        } else {
          const scholar = await getScholarById(recipientId)
          if (scholar) {
            setRecipient(scholar)
          }
          setLoading(false)
        }
      }
      checkConversation()
    } else if (!recipientId) {
      setLoading(false)
    }
  }, [user, recipientId, router, toast])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <CreateOrEditPageShell
      title={isGroup ? "New Group" : "New Message"}
      description={isGroup ? "Create a private discussion group with up to eight scholars." : "Start a new conversation with another scholar."}
      backHref="/messages"
      backLabel="Back to Messages"
      maxWidth="md"
    >
      {/* No width wrapper: the form spans the shell's max-w-4xl, so the card
          aligns exactly with the title above it — same as every other add/edit
          page (events, grants, blog, ...). */}
      {!isGroup && <div className="mb-4 flex justify-end"><Link href="/messages/new?group=1" className="sb-button-soft">Create a group</Link></div>}
      {isGroup ? <NewGroupForm contextType={contextType} contextId={contextId} initialTitle={groupTitle} /> : <NewMessageForm initialRecipient={recipient} />}
    </CreateOrEditPageShell>
  )
}

export default function NewConversationPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center p-4"><p>Loading...</p></div>}>
      <NewConversationPageContent />
    </Suspense>
  )
}
