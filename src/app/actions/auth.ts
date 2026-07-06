'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        redirect('/login?message=Incorrect email or password')
    }

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

    redirect('/login?message=Check your email to confirm your account')
}

export async function signInWithGoogle() {
    const supabase = await createClient()

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${baseUrl}/auth/callback`,
            queryParams: {
                prompt: 'select_account',
            },
        },
    })

    if (error || !data.url) {
        redirect('/login?message=Could not start Google sign-in')
    }

    redirect(data.url)
}

export async function signOut() {
    const supabase = await createClient()

    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}
