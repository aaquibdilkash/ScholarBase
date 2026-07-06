'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?message=Incorrect email or password')
  }

  // Revalidate the layout to update any Navbar state and redirect to the blog
  revalidatePath('/', 'layout')
  redirect('/blog')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    redirect('/login?message=Could not create account')
  }

  // By default, Supabase requires email confirmation.
  redirect('/login?message=Check your email to confirm your account')
}

// Add this below your existing login and signup functions in actions.ts
export async function signInWithGoogle() {
  const supabase = await createClient()

  // Get the base URL dynamically
  const getBaseUrl = () => {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // This will now work in both dev and production
      redirectTo: `${getBaseUrl()}/auth/callback`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (data.url) {
    redirect(data.url)
  }
}

export async function signOut() {
    const supabase = await createClient()

    // Tell Supabase to destroy the session
    await supabase.auth.signOut()

    // Clear the Next.js cache so the Navbar updates instantly
    revalidatePath('/', 'layout')

    // Kick them back to the login page
    redirect('/login')
}