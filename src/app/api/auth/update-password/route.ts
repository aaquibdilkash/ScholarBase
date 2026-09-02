import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getRequestFingerprint,
  hashRateLimitKey,
  RATE_LIMIT_ERROR,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const requestKey = getRequestFingerprint(req.headers);
  const supabase = await createClient();
  const formData = await req.formData();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const [ipLimit, passwordLimit] = await Promise.all([
    checkRateLimit({
      namespace: "auth:update-password:ip",
      key: requestKey,
      limit: 10,
      window: "1 h",
    }),
    checkRateLimit({
      namespace: "auth:update-password:password",
      key: hashRateLimitKey(password ?? ""),
      limit: 5,
      window: "1 h",
    }),
  ])

  if (!ipLimit.allowed || !passwordLimit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 })
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      {
        error: "Your reset link is missing or expired. Please request a new password reset link.",
      },
      { status: 401 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    message: "Password updated successfully. Please sign in.",
  });
}
