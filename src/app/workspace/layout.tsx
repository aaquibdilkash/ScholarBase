import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser, isUserAdmin } from "@/lib/auth";
import { buildNoindexMetadata } from "@/lib/seo";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";

/**
 * Signed-in publishing workspace.
 *
 * `noindex` covers every child route: submissions, review assignments, and
 * unpublished venue settings must never be crawled, even by accident.
 */
export const metadata: Metadata = buildNoindexMetadata("Workspace - ScholarBase");

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = await isUserAdmin(user.id);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <WorkspaceNav isAdmin={isAdmin} />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
