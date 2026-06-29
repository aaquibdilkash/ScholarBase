'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signOut() {
    const supabase = await createClient()

    // Tell Supabase to destroy the session
    await supabase.auth.signOut()

    // Clear the Next.js cache so the Navbar updates instantly
    revalidatePath('/', 'layout')

    // Kick them back to the login page
    redirect('/login')
}