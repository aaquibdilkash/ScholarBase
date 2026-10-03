import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SEO_PAGES } from "@/constants/seo";

export const metadata: Metadata = buildMetadata({
  title: SEO_PAGES.login.title,
  description: SEO_PAGES.login.description,
  path: SEO_PAGES.login.path,
});
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { Suspense } from "react";

interface LoginPageProps {
  searchParams: Promise<{
    message?: string;
    error?: string;
    callbackUrl?: string;
    type?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const { callbackUrl, error } = await searchParams;
  let returnUrl = callbackUrl || "/";

  if (returnUrl === "/") {
    try {
      const cookieStore = await (await import("next/headers")).cookies();
      const stored = cookieStore.get("sb_callback_url");
      if (stored?.value) {
        returnUrl = stored.value;
      }
    } catch {}
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm returnUrl={returnUrl} initialError={error} />
    </Suspense>
  );
}
