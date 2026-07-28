'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getBaseUrl } from '@/lib/url'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const callbackUrl = (formData.get('callbackUrl') as string) || '/blog'

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
    const callbackUrl = (formData.get('callbackUrl') as string) || '/blog'

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
        redirect(`/login?message=Could not create account&callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }

    redirect(`/login?message=Check your email to confirm your account&callbackUrl=${encodeURIComponent(callbackUrl)}`)
}

export async function signInWithGoogle(callbackUrl?: string) {
    const supabase = await createClient()
    const baseUrl = await getBaseUrl()

    const target = callbackUrl || '/blog'

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

export async function forgotPassword(formData: FormData) {
    const supabase = await createClient()
    const baseUrl = await getBaseUrl()

    const email = formData.get('email') as string

    if (!email) {
        redirect('/login?message=Please enter your email address')
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/login?message=Password reset link sent! Check your email.`,
    })

    if (error) {
        redirect(`/login?message=${encodeURIComponent(error.message)}`)
    }

    redirect('/login?message=Password reset link sent! Check your email.')
}

export async function signOut() {
    const supabase = await createClient()

    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}
