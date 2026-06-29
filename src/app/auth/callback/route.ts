import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/db'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/blog'

    if (code) {
        const supabase = await createClient()
        // 1. Authenticate the user with Supabase
        const { error, data: { user } } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && user) {
            // 2. Check if this user exists in Prisma
            const existingUser = await prisma.user.findUnique({
                where: { id: user.id }
            })

            // 3. If they don't exist, create their public profile using Google's metadata
            if (!existingUser) {
                await prisma.user.create({
                    data: {
                        id: user.id, // We use the exact same UUID as Supabase
                        email: user.email!,
                        name: user.user_metadata.full_name || user.email?.split('@')[0],
                        avatarUrl: user.user_metadata.avatar_url || null,
                    }
                })
            }

            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    return NextResponse.redirect(`${origin}/login?message=Could not authenticate with Google`)
}