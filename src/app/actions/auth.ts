'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getBaseUrl } from '@/lib/url'

function mapAuthError(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('email') && lower.includes('already')) {
        return 'An account with this email already exists. Try signing in instead.'
    }
    if (lower.includes('password') && lower.includes('weak')) {
        return 'Password is too weak. Use at least 6 characters with a mix of letters and numbers.'
    }
    if (lower.includes('invalid') && lower.includes('email')) {
        return 'Please enter a valid email address.'
    }
    if (lower.includes('rate') || lower.includes('too many')) {
        return 'Too many attempts. Please wait a moment and try again.'
    }
    return message
}

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const callbackUrl = (formData.get('callbackUrl') as string) || '/'

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        redirect(`/login?message=Incorrect email or password&callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }

    revalidatePath('/', 'layout')
    redirect(callbackUrl)
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const callbackUrl = (formData.get('callbackUrl') as string) || '/'

    if (!email || !password) {
        redirect(`/login?message=Email and password are required&callbackUrl=${encodeURIComponent(callbackUrl)}`)
        return
    }

    if (password.length < 6) {
        redirect(`/login?message=Password must be at least 6 characters&callbackUrl=${encodeURIComponent(callbackUrl)}`)
        return
    }

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
        const message = mapAuthError(error.message)
        redirect(`/login?message=${encodeURIComponent(message)}&callbackUrl=${encodeURIComponent(callbackUrl)}`)
        return
    }

    redirect(`/login?message=Check your email to confirm your account&callbackUrl=${encodeURIComponent(callbackUrl)}`)
}

export async function signInWithGoogle(callbackUrl?: string) {
    const supabase = await createClient()
    const baseUrl = await getBaseUrl()

    const target = callbackUrl || '/'

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${baseUrl}/auth/callback?callbackUrl=${encodeURIComponent(target)}`,
            queryParams: {
                prompt: 'select_account',
            },
        },
    })

    if (error || !data.url) {
        redirect(`/login?message=Could not start Google sign-in&callbackUrl=${encodeURIComponent(target)}`)
    }

    redirect(data.url)
}

export async function forgotPassword(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const email = formData.get("email") as string;

  if (!email) {
    return { success: false, error: "Please enter your email address" };
  }

  const redirectTo = `${baseUrl}/auth/callback?next=/auth/update-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }

  return { success: true };
}


export async function signOut() {
    const supabase = await createClient()

    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}
