'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBaseUrl } from '@/lib/url'

type AuthResult = { success: true; redirect?: string; message?: string; url?: string } | { success: false; error: string }

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

export async function login(formData: FormData): Promise<AuthResult> {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const callbackUrl = (formData.get('callbackUrl') as string) || '/'

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        return { success: false, error: 'Incorrect email or password.' }
    }

    return { success: true, redirect: callbackUrl }
}

export async function signup(formData: FormData): Promise<AuthResult> {
    const supabase = await createClient()
    const baseUrl = await getBaseUrl()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    if (!email || !password) {
        return { success: false, error: 'Email and password are required.' }
    }

    if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' }
    }

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${baseUrl}/auth/callback?next=/auth/confirmed`,
        },
    })

    if (error) {
        const message = mapAuthError(error.message)
        return { success: false, error: message }
    }

    return { success: true, message: 'Check your email to confirm your account.' }
}

export async function signInWithGoogle(callbackUrl?: string): Promise<AuthResult> {
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
        return { success: false, error: 'Could not start Google sign-in.' }
    }

    return { success: true, url: data.url }
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
    redirect('/login')
}
