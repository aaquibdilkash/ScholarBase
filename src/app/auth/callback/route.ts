import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ensureUserProfile } from '@/lib/users'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const type = searchParams.get('type')
    // Support callbackUrl from OAuth redirectTo; fall back to sessionStorage
    let callbackUrl = searchParams.get('callbackUrl') ?? searchParams.get('next') ?? '/feed'
    const safeRedirect = (() => {
        try {
            const target = new URL(callbackUrl, origin)
            return target.origin === origin ? target : new URL('/feed', origin)
        } catch {
            return new URL('/feed', origin)
        }
    })()

    if (type === 'recovery') {
        // Password recovery flow - redirect to /login with type=recovery
        // Supabase session is handled via the hash fragment
        return NextResponse.redirect(`${origin}/login?type=recovery`)
    }

    if (code) {
        const supabase = await createClient()
        const { error, data: { user } } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && user) {
            await ensureUserProfile(user)
            return NextResponse.redirect(safeRedirect)
        }
    }

    return NextResponse.redirect(`${origin}/login?message=Could not authenticate with Google`)
}
