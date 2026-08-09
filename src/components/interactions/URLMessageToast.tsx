'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

export function URLMessageToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const message = searchParams.get('message')
    if (message) {
      toast(message, 'error')
      // Remove the message from the URL so it doesn't show up again
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('message')
      router.replace(`${window.location.pathname}?${newSearchParams.toString()}`)
    }
  }, [searchParams, router, toast])

  return null
}
