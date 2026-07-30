import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const callbackUrl = searchParams.get("callbackUrl");
  const type = searchParams.get("type");

  if (type === "recovery") {
    // This is a password reset callback.
    // The user has been authenticated by the link in the email.
    // The middleware has run and set the session cookie.
    // Now we can redirect them to the password update form.
    return NextResponse.redirect(
      new URL(`/login?type=recovery`, request.url)
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(callbackUrl || "/feed", request.url));
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(new URL("/login?message=Could not process authentication.", request.url));
}
