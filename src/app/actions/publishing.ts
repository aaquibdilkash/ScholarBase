"use server";

import { revalidatePath } from "next/cache";
import type { EditorialRoleTitle } from "@prisma/client";

import prisma from "@/lib/db";
import { getActiveUser, isUserAdmin, requireAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue } from "@/lib/form";
import { normalizeEmail, validateEmailFormat } from "@/lib/email-normalizer";
import {
  MAX_VENUE_NAME,
  isValidVenueSlug,
  normalizeVenueSlug,
} from "@/lib/publishing/slug";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { assertRichTextWithinLimit, readOptionalShortText } from "@/lib/form";
import {
  MAX_VENUE_BOARD_AFFILIATION,
  MAX_VENUE_BOARD_MEMBERS,
  MAX_VENUE_BOARD_NAME,
  MAX_VENUE_BOARD_ORCID,
  MAX_VENUE_BOARD_ROLE,
  MAX_VENUE_CONTACT_EMAIL,
  MAX_VENUE_EDITOR_AFFILIATION,
  MAX_VENUE_EDITOR_NAME,
  MAX_VENUE_FREQUENCY,
  MAX_VENUE_RICH_TEXT,
} from "@/lib/publishing/constants";

/**
 * Venue provisioning for platform owners.
 *
 * Deliberately narrow: create a venue, publish/unpublish it, grant or revoke an
 * editorial seat. Venue *content* (aims, guidelines, board, identifiers) belongs
 * to the editor-in-chief and lives in `/workspace/editorial/settings`, so this
 * module never touches those columns.
 *
 * Every action is `requireAdmin()` — a venue row decides what appears in the
 * sitemap and who may review papers, so it is not a venue-role decision.
 */

export type VenueActionResult = {
  success: boolean;
  message: string;
};

function readBounded(formData: FormData, key: string, max: number, label: string): string | null {
  return readOptionalShortText(formData, key, max, label);
}

const VENUE_TYPES = ["JOURNAL", "CONFERENCE"] as const;
const ROLE_TITLES: readonly EditorialRoleTitle[] = [
  "EDITOR_IN_CHIEF",
  "TRACK_CHAIR",
  "ASSOC_EDITOR",
];

function fail(message: string): VenueActionResult {
  return { success: false, message };
}

export async function createVenueAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const admin = await requireAdmin();

  const limit = await enforceRateLimit({
    namespace: "venue:create",
    key: admin.id,
    limit: 5,
    window: "10 m",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const name = readFormValue(formData, "name");
  const slug = normalizeVenueSlug(readFormValue(formData, "slug"));
  const type = readFormValue(formData, "type");

  if (name.length < 3 || name.length > MAX_VENUE_NAME) {
    return fail(`Name must be between 3 and ${MAX_VENUE_NAME} characters.`);
  }
  if (slug.length < 3 || !isValidVenueSlug(slug)) {
    return fail(
      "Slug must be 3–48 characters of lowercase letters, numbers, and single hyphens.",
    );
  }
  if (!VENUE_TYPES.includes(type as (typeof VENUE_TYPES)[number])) {
    return fail("Choose a venue type.");
  }

  const existing = await prisma.venue.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) return fail(`The slug "${slug}" is already used by another venue.`);

  const venue = await prisma.venue.create({
    data: {
      name,
      slug,
      type: type as (typeof VENUE_TYPES)[number],
      // Never published on creation: indexing is a separate, deliberate action
      // that has to pass the readiness checks below.
      isPublished: false,
    },
    select: { name: true, slug: true },
  });

  revalidatePath("/workspace/admin");
  return {
    success: true,
    message: `Created ${venue.name} at /${venue.slug}. Set up its board and policies, then publish.`,
  };
}

/**
 * Publishing is what puts a venue in the sitemap, so it carries the readiness
 * checks that ISSN reviewers apply. An empty venue indexed by a crawler is
 * thin content that is very hard to un-index later.
 */
export async function setVenuePublishedAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const admin = await requireAdmin();

  const limit = await enforceRateLimit({
    namespace: "venue:publish",
    key: admin.id,
    limit: 20,
    window: "10 m",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const venueId = readFormValue(formData, "venueId");
  const published = readFormValue(formData, "published") === "true";

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      name: true,
      slug: true,
      isPublished: true,
      editorName: true,
      aimsAndScope: true,
    },
  });
  if (!venue) return fail("That venue no longer exists.");

  if (published) {
    // A separate `findMany({ take: 1 })` rather than `_count`: the readiness
    // check only needs to know whether the board is empty, and one indexed row
    // read is cheaper than a count over the whole board.
    const boardMember = await prisma.editorialBoardMember.findMany({
      where: { venueId: venue.id },
      take: 1,
      select: { id: true },
    });

    const missing: string[] = [];
    if (!venue.editorName?.trim()) missing.push("a named editor-in-chief");
    if (!venue.aimsAndScope?.trim()) missing.push("aims & scope");
    if (boardMember.length === 0) missing.push("at least one editorial board member");
    if (venue.slug.length < 3) missing.push("a valid slug");

    if (missing.length > 0) {
      return fail(`Add ${missing.join(", ")} before publishing ${venue.name}.`);
    }
  }

  await prisma.venue.update({
    where: { id: venue.id },
    data: {
      isPublished: published,
      launchedAt: published ? new Date() : null,
    },
  });

  revalidatePath("/workspace/admin");
  revalidatePath(`/${venue.slug}`);
  return {
    success: true,
    message: published
      ? `${venue.name} is published and can now be indexed.`
      : `${venue.name} is unpublished and no longer indexable.`,
  };
}

/**
 * Deletes an empty, unpublished venue. Published venues and venues with
 * manuscript history are intentionally retained so public citations and
 * editorial records cannot be destroyed from the provisioning screen.
 */
export async function deleteVenueAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const admin = await requireAdmin();
  const limit = await enforceRateLimit({
    namespace: "venue:delete",
    key: admin.id,
    limit: 10,
    window: "10 m",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const venueId = readFormValue(formData, "venueId");
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, name: true, slug: true, type: true, isPublished: true },
  });
  if (!venue) return fail("That venue no longer exists.");
  if (venue.isPublished) {
    return fail("Unpublish the venue before deleting it.");
  }

  const manuscript = await prisma.manuscript.findFirst({
    where: { venueId: venue.id },
    select: { id: true },
  });
  if (manuscript) {
    return fail("This venue has manuscript history and cannot be deleted.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.editorialRole.deleteMany({ where: { venueId: venue.id } });
      await tx.editorialBoardMember.deleteMany({ where: { venueId: venue.id } });
      await tx.venue.delete({ where: { id: venue.id } });
    });
  } catch {
    return fail("The venue could not be deleted. It may have acquired records in another session.");
  }

  revalidatePath("/workspace/admin");
  revalidatePath(`/${venue.type === "JOURNAL" ? "sbj" : "sbc"}/${venue.slug}`);
  return { success: true, message: `${venue.name} was deleted.` };
}

export async function grantEditorialRoleAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const admin = await requireAdmin();

  const limit = await enforceRateLimit({
    namespace: "venue:role",
    key: admin.id,
    limit: 30,
    window: "10 m",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const venueId = readFormValue(formData, "venueId");
  const email = normalizeEmail(readFormValue(formData, "email"));
  const roleTitle = readFormValue(formData, "roleTitle") as EditorialRoleTitle;

  if (!validateEmailFormat(email)) return fail("Enter the editor's account email.");
  if (!ROLE_TITLES.includes(roleTitle)) return fail("Choose an editorial role.");

  const [venue, user] = await Promise.all([
    prisma.venue.findUnique({ where: { id: venueId }, select: { name: true } }),
    prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, isDeleted: true },
    }),
  ]);

  if (!venue) return fail("That venue no longer exists.");
  if (!user || user.isDeleted) {
    return fail("No active ScholarBase account uses that email.");
  }

  await prisma.editorialRole.upsert({
    where: {
      userId_venueId_roleTitle: {
        userId: user.id,
        venueId,
        roleTitle,
      },
    },
    update: {},
    create: { userId: user.id, venueId, roleTitle },
  });

  revalidatePath("/workspace/admin");
  return {
    success: true,
    message: `${user.name ?? email} is now ${roleTitle.replace(/_/g, " ").toLowerCase()} at ${venue.name}.`,
  };
}

export async function revokeEditorialRoleAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const admin = await requireAdmin();

  const limit = await enforceRateLimit({
    namespace: "venue:role",
    key: admin.id,
    limit: 30,
    window: "10 m",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const roleId = readFormValue(formData, "roleId");
  if (!roleId) return fail("That role no longer exists.");

  // `deleteMany` instead of `delete`: a stale row (already revoked in another
  // tab) must not throw and mask itself as a server error.
  const { count } = await prisma.editorialRole.deleteMany({ where: { id: roleId } });
  if (count === 0) return fail("That role no longer exists.");

  revalidatePath("/workspace/admin");
  return { success: true, message: "Editorial role revoked." };
}

/**
 * Updates the public venue profile. An editor-in-chief may edit only venues
 * where they hold that seat; platform admins may repair any venue.
 */
export async function updateVenueSettingsAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const active = await getActiveUser();
  if (active.frozen) return fail(active.message);
  const user = active.user;
  const limit = await enforceRateLimit({
    namespace: "venue:settings",
    key: user.id,
    limit: 20,
    window: "10 m",
  });
  if (!limit.allowed) return { success: false, message: limit.error };
  const admin = await isUserAdmin(user.id);
  const venueId = readFormValue(formData, "venueId");
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, name: true, slug: true, type: true },
  });
  if (!venue) return fail("That venue no longer exists.");

  if (!admin) {
    const seat = await prisma.editorialRole.findFirst({
      where: { venueId, userId: user.id, roleTitle: "EDITOR_IN_CHIEF" },
      select: { id: true },
    });
    if (!seat) return fail("Only this venue's editor-in-chief can edit its settings.");
  }

  const name = readFormValue(formData, "name");
  if (name.length < 3 || name.length > MAX_VENUE_NAME) {
    return fail(`Name must be between 3 and ${MAX_VENUE_NAME} characters.`);
  }

  let editorName: string | null;
  let editorAffiliation: string | null;
  let frequency: string | null;
  let contactEmail: string | null;
  try {
    editorName = readBounded(formData, "editorName", MAX_VENUE_EDITOR_NAME, "Editor name");
    editorAffiliation = readBounded(
      formData,
      "editorAffiliation",
      MAX_VENUE_EDITOR_AFFILIATION,
      "Editor affiliation",
    );
    frequency = readBounded(formData, "frequency", MAX_VENUE_FREQUENCY, "Frequency");
    contactEmail = readBounded(
      formData,
      "contactEmail",
      MAX_VENUE_CONTACT_EMAIL,
      "Contact email",
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid venue profile.");
  }
  if (contactEmail && !validateEmailFormat(normalizeEmail(contactEmail))) {
    return fail("Enter a valid venue contact email.");
  }

  const richTextFields = [
    ["aimsAndScope", "Aims and scope"],
    ["authorGuidelines", "Author guidelines"],
    ["peerReviewPolicy", "Peer-review policy"],
    ["ethicsPolicy", "Ethics policy"],
  ] as const;
  let richText: Record<string, string | null>;
  try {
    richText = Object.fromEntries(
      richTextFields.map(([key, label]) => {
        const value = sanitizeRichHtml(readFormValue(formData, key));
        assertRichTextWithinLimit(value, MAX_VENUE_RICH_TEXT, label);
        return [key, value || null];
      }),
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid venue policy content.");
  }

  const names = formData.getAll("boardName").filter((value): value is string => typeof value === "string");
  const roles = formData.getAll("boardRoleTitle").filter((value): value is string => typeof value === "string");
  const affiliations = formData.getAll("boardAffiliation").filter((value): value is string => typeof value === "string");
  const orcids = formData.getAll("boardOrcid").filter((value): value is string => typeof value === "string");
  if (names.length > MAX_VENUE_BOARD_MEMBERS) {
    return fail(`Add no more than ${MAX_VENUE_BOARD_MEMBERS} board members.`);
  }
  if (roles.length !== names.length || affiliations.length !== names.length || orcids.length !== names.length) {
    return fail("Each board member row must include all of its fields.");
  }

  let board: Array<{
    name: string;
    roleTitle: string;
    affiliation: string | null;
    orcid: string | null;
    venueId: string;
  }>;
  try {
    board = names.map((rawName, index) => {
      const name = rawName.trim();
      const roleTitle = roles[index].trim();
      if (!name || !roleTitle) throw new Error("Each board member needs a name and role.");
      if (name.length > MAX_VENUE_BOARD_NAME) throw new Error(`Board member name is too long (max ${MAX_VENUE_BOARD_NAME} characters).`);
      if (roleTitle.length > MAX_VENUE_BOARD_ROLE) throw new Error(`Board role is too long (max ${MAX_VENUE_BOARD_ROLE} characters).`);
      const affiliation = affiliations[index].trim();
      const orcid = orcids[index].trim();
      if (affiliation.length > MAX_VENUE_BOARD_AFFILIATION) throw new Error(`Board affiliation is too long (max ${MAX_VENUE_BOARD_AFFILIATION} characters).`);
      if (orcid.length > MAX_VENUE_BOARD_ORCID) throw new Error(`ORCID is too long (max ${MAX_VENUE_BOARD_ORCID} characters).`);
      return { name, roleTitle, affiliation: affiliation || null, orcid: orcid || null, venueId };
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid editorial board.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.venue.update({
        where: { id: venueId },
        data: {
          name,
          editorName,
          editorAffiliation,
          frequency,
          contactEmail: contactEmail ? normalizeEmail(contactEmail) : null,
          ...richText,
        },
      });
      await tx.editorialBoardMember.deleteMany({ where: { venueId } });
      if (board.length > 0) await tx.editorialBoardMember.createMany({ data: board });
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not save venue settings.");
  }

  revalidatePath("/workspace/editorial/settings");
  revalidatePath("/workspace/admin");
  revalidatePath(`/${venue.type === "JOURNAL" ? "sbj" : "sbc"}/${venue.slug}`);
  return { success: true, message: `${venue.name} settings saved.` };
}
