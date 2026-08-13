import { createClient } from "@/utils/supabase/server";
import {NextRequest, NextResponse} from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const formData = await req.formData();
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(
    `${req.nextUrl.origin}/login?message=Password updated successfully. Please sign in.`
  );
}
