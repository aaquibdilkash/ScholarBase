import { redirect } from "next/navigation";

import { VenueSettingsPanel, type VenueSettingsValues } from "@/components/workspace/VenueSettingsForm";
import { getCurrentUser, isUserAdmin } from "@/lib/auth";
import prisma from "@/lib/db";

export default async function EditorialSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ venue?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const admin = await isUserAdmin(user.id);
  const venues = await prisma.venue.findMany({
    where: admin
      ? undefined
      : { team: { some: { userId: user.id, roleTitle: "EDITOR_IN_CHIEF" } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      editorName: true,
      editorAffiliation: true,
      frequency: true,
      contactEmail: true,
      aimsAndScope: true,
      authorGuidelines: true,
      peerReviewPolicy: true,
      ethicsPolicy: true,
      board: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { name: true, roleTitle: true, affiliation: true, orcid: true },
      },
    },
  });

  const values: VenueSettingsValues[] = venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    type: venue.type,
    editorName: venue.editorName ?? "",
    editorAffiliation: venue.editorAffiliation ?? "",
    frequency: venue.frequency ?? "",
    contactEmail: venue.contactEmail ?? "",
    aimsAndScope: venue.aimsAndScope ?? "",
    authorGuidelines: venue.authorGuidelines ?? "",
    peerReviewPolicy: venue.peerReviewPolicy ?? "",
    ethicsPolicy: venue.ethicsPolicy ?? "",
    board: venue.board.map((member) => ({
      name: member.name,
      roleTitle: member.roleTitle,
      affiliation: member.affiliation ?? "",
      orcid: member.orcid ?? "",
    })),
  }));

  const params = await searchParams;

  return (
    <main>
      <header className="mb-6">
        <h1 className="sb-heading text-2xl">Editorial venue settings</h1>
        <p className="mt-2 text-base text-slate-300 dark:text-slate-300">
          Edit the public profile, policies, and structured editorial board for your venue.
        </p>
      </header>
      {values.length === 0 ? (
        <p className="sb-card text-sm text-slate-300 dark:text-slate-300">
          No venue is assigned to you as editor-in-chief yet. A platform administrator can grant that role from Publishing administration.
        </p>
      ) : (
        <VenueSettingsPanel venues={values} initialVenueId={params?.venue} />
      )}
    </main>
  );
}
