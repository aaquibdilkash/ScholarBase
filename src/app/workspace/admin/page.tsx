import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser, isUserAdmin } from "@/lib/auth";
import prisma from "@/lib/db";
import { buildNoindexMetadata } from "@/lib/seo";
import {
  VenueAdminPanel,
  type VenueAdminRow,
  type VenueAdminRole,
} from "@/components/workspace/VenueAdminPanel";

export const metadata: Metadata = buildNoindexMetadata(
  "Publishing administration - ScholarBase",
);

/**
 * Platform-owner venue provisioning.
 *
 * Deliberately separate from `/workspace/editorial/settings`: an
 * `EDITOR_IN_CHIEF` edits their own venue's content, but creating a venue —
 * which decides what is indexable and who may review — is a platform decision.
 */
export default async function WorkspaceAdminPage() {
  const user = await getCurrentUser();

  if (!user || !(await isUserAdmin(user.id))) {
    redirect("/");
  }

  const [venues, roles] = await Promise.all([
    prisma.venue.findMany({
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        isPublished: true,
        isDemo: true,
        issn: true,
        eissn: true,
        editorName: true,
        _count: { select: { board: true, manuscripts: true } },
      },
    }),
    prisma.editorialRole.findMany({
      orderBy: [{ roleTitle: "asc" }],
      select: {
        id: true,
        roleTitle: true,
        venueId: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  // One pass, so each venue row does not filter the whole role list.
  const rolesByVenue = new Map<string, VenueAdminRole[]>();
  for (const role of roles) {
    const list = rolesByVenue.get(role.venueId) ?? [];
    list.push({
      id: role.id,
      roleTitle: role.roleTitle,
      userName: role.user.name,
      userEmail: role.user.email,
    });
    rolesByVenue.set(role.venueId, list);
  }

  const rows: VenueAdminRow[] = venues.map((venue) => ({
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    isPublished: venue.isPublished,
    isDemo: venue.isDemo,
    issn: venue.issn,
    eissn: venue.eissn,
    editorName: venue.editorName,
    boardCount: venue._count.board,
    manuscriptCount: venue._count.manuscripts,
    roles: rolesByVenue.get(venue.id) ?? [],
  }));

  return (
    <main>
      <header className="mb-6">
        <h1 className="sb-heading text-2xl">Publishing administration</h1>
        <p className="sb-subtitle mt-2 text-sm">
          Create journals and conferences, publish them when they are ready to be
          indexed, and grant editorial roles.
        </p>
      </header>

      <VenueAdminPanel venues={rows} />
    </main>
  );
}
