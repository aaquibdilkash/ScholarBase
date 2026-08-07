'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { findDirectConversation } from '@/app/actions/messages'
import { getScholarById } from '@/app/actions/scholars'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { NewMessageForm } from '@/components/messages/NewMessageForm'
import { useToast } from '@/components/ui/Toast'

type Scholar = NonNullable<Awaited<ReturnType<typeof getScholarById>>>

function NewConversationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const recipientId = searchParams.get('to')
  const [user, setUser] = useState<User | null>(null)
  const [recipient, setRecipient] = useState<Scholar | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const supabase = createClient()
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
        const conversationId = await findDirectConversation(user.id, recipientId)
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
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">New Message</h1>
        <NewMessageForm initialRecipient={recipient} />
      </div>
    </div>
  )
}

export default function NewConversationPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center p-4"><p>Loading...</p></div>}>
      <NewConversationPageContent />
    </Suspense>
  )
}
