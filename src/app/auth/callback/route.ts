import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const callbackUrl = searchParams.get("callbackUrl");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(
          new URL(`/login?type=recovery`, request.url)
        );
      }
      return NextResponse.redirect(new URL(callbackUrl || "/feed", request.url));
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(
    new URL("/login?message=Could not process authentication.", request.url)
  );
}
