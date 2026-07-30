import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const formData = await request.formData();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?type=recovery&message=Passwords do not match`,
      {
        status: 301,
      }
    );
  }

  if (password.length < 6) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?type=recovery&message=Password must be at least 6 characters`,
      {
        status: 301,
      }
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?type=recovery&message=Could not update password. Please try again.`,
      {
        status: 301,
      }
    );
  }

  return NextResponse.redirect(
    `${requestUrl.origin}/login?message=Password updated successfully. Please sign in.`,
    {
      status: 301,
    }
  );
}

