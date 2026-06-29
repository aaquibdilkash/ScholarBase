// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // 1. Define your exact static paths
    const staticProtectedPaths = ['/blog/new', '/supervisor/add', '/feed']

    const pathname = request.nextUrl.pathname

    // 2. Check if it matches a static path OR the dynamic recommend path
    const isProtectedPath =
        staticProtectedPaths.includes(pathname) ||
        (pathname.startsWith('/supervisor/') && pathname.endsWith('/recommend'))

    // 3. Trigger the redirect if they aren't logged in
    if (!user && isProtectedPath) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('message', 'Please log in to access this page.')
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

// Ensure the middleware only runs on actual pages, not static files/images
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}