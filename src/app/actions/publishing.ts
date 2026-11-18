"use server";

import { revalidatePath } from "next/cache";
import type { EditorialRoleTitle } from "@prisma/client";

import prisma from "@/lib/db";
import { getActiveUser, isUserAdmin, requireAdmin } from "@/lib/auth";
import { notifyUserById } from "@/lib/notifications";
import { EDITORIAL_ROLE_LABELS } from "@/lib/publishing/labels";
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
import {
  isValidEditionSlug,
  normalizeEditionSlug,
} from "@/lib/publishing/editions";
import { isValidIsbn13, normalizeIsbn } from "@/lib/publishing/identifiers";
import { promoteContentImages } from "@/lib/content-images";

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

export async function createConferenceEditionAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);
  const venueId = readFormValue(formData, "venueId");
  const [admin, role] = await Promise.all([
    isUserAdmin(auth.user.id),
    prisma.editorialRole.findFirst({ where: { userId: auth.user.id, venueId, roleTitle: "EDITOR_IN_CHIEF" }, select: { id: true } }),
  ]);
  if (!admin && !role) return fail("Only the venue Editor-in-Chief can create an edition.");

  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, type: true, slug: true, name: true } });
  if (!venue || venue.type !== "CONFERENCE") return fail("Choose a conference venue.");
  const year = Number(readFormValue(formData, "year"));
  const termRaw = readFormValue(formData, "term").trim().toLowerCase();
  const term = termRaw || null;
  const slug = normalizeEditionSlug(readFormValue(formData, "slug"));
  const label = readFormValue(formData, "label").trim();
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return fail("Enter a valid edition year.");
  if (term !== null && !["h1", "h2", "q1", "q2", "q3", "q4"].includes(term)) return fail("Term must be H1, H2, Q1, Q2, Q3, or Q4.");
  if (!isValidEditionSlug(slug)) return fail("Use an edition key such as 2027, 2027-h1, or 2027-q3.");
  if (!label || label.length > 120) return fail("Add an edition label up to 120 characters.");
  const volumeRaw = readFormValue(formData, "volume").trim();
  const volume = volumeRaw ? Number(volumeRaw) : null;
  if (volume !== null && (!Number.isInteger(volume) || volume < 1)) return fail("Volume must be a positive whole number.");
  const isbnRaw = readFormValue(formData, "isbn").trim();
  if (isbnRaw && !isValidIsbn13(isbnRaw)) return fail("That ISBN-13 is not valid.");
  const websiteUrl = readOptionalUrl(formData, "websiteUrl");
  if (readFormValue(formData, "websiteUrl").trim() && !websiteUrl) return fail("The edition website must be a valid HTTPS URL.");
  const proceedingsDoi = readFormValue(formData, "proceedingsDoi").trim() || null;
  if (proceedingsDoi && !/^10\.\d{4,9}\/\S+$/i.test(proceedingsDoi)) return fail("Enter a valid proceedings DOI.");
  const coverImageUrl = readOptionalUrl(formData, "coverImageUrl");
  if (readFormValue(formData, "coverImageUrl").trim() && !coverImageUrl) return fail("The edition cover must be a valid HTTPS URL.");
  const timezone = readOptionalTimezone(formData, "timezone");
  if (readFormValue(formData, "timezone").trim() && !timezone) return fail("Enter a valid IANA timezone, such as Asia/Kolkata.");

  try {
    await prisma.conferenceEdition.create({
      data: {
        venueId: venue.id,
        year,
        term,
        slug,
        label,
        volume,
        isbn: isbnRaw ? normalizeIsbn(isbnRaw) : null,
        startsAt: readOptionalIsoDate(formData, "startsAt"),
        endsAt: readOptionalIsoDate(formData, "endsAt"),
        location: readFormValue(formData, "location").trim() || null,
        timezone,
        websiteUrl,
        cfpOpenAt: readOptionalIsoDate(formData, "cfpOpenAt"),
        submissionDeadline: readOptionalIsoDate(formData, "submissionDeadline"),
        notificationAt: readOptionalIsoDate(formData, "notificationAt"),
        cameraReadyAt: readOptionalIsoDate(formData, "cameraReadyAt"),
        proceedingsDoi,
        coverImageUrl,
        status: "DRAFT",
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
      return fail("An edition with that key already exists for this conference.");
    }
    throw error;
  }
  revalidatePath("/workspace/editorial/settings");
  revalidatePath(`/sbc/${venue.slug}`);
  return { success: true, message: `${label} was created.` };
}

export async function updateConferenceEditionAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);
  const editionId = readFormValue(formData, "editionId");
  const status = readFormValue(formData, "status");
  const allowed = ["DRAFT", "CFP_OPEN", "REVIEW", "NOTIFICATION", "PROGRAM", "COMPLETED", "ARCHIVED"] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) return fail("Choose a valid edition status.");
  if (status === "DRAFT" && readFormValue(formData, "isPublished") === "true") return fail("A draft edition cannot be public. Move it to CFP open or later first.");
  const edition = await prisma.conferenceEdition.findUnique({ where: { id: editionId }, select: { id: true, venueId: true, status: true, volume: true, coverImageUrl: true, venue: { select: { slug: true } } } });
  if (!edition) return fail("That edition no longer exists.");
  const nextStatus = status as (typeof allowed)[number];
  const nextStatuses: Record<string, readonly string[]> = {
    DRAFT: ["CFP_OPEN", "ARCHIVED"],
    CFP_OPEN: ["REVIEW", "ARCHIVED"],
    REVIEW: ["NOTIFICATION", "ARCHIVED"],
    NOTIFICATION: ["PROGRAM", "ARCHIVED"],
    PROGRAM: ["COMPLETED", "ARCHIVED"],
    COMPLETED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  if (nextStatus !== edition.status && !nextStatuses[edition.status]?.includes(nextStatus)) return fail(`An edition cannot move from ${edition.status.replace(/_/g, " ")} to ${nextStatus.replace(/_/g, " ")}.`);
  if (nextStatus === "COMPLETED" && !edition.volume) return fail("Assign the proceedings volume before completing the edition.");
  const [admin, role] = await Promise.all([
    isUserAdmin(auth.user.id),
    prisma.editorialRole.findFirst({ where: { userId: auth.user.id, venueId: edition.venueId, roleTitle: "EDITOR_IN_CHIEF" }, select: { id: true } }),
  ]);
  if (!admin && !role) return fail("Only the venue Editor-in-Chief can update an edition.");
  const isPublished = readFormValue(formData, "isPublished") === "true";
  const websiteUrl = readOptionalUrl(formData, "websiteUrl");
  if (readFormValue(formData, "websiteUrl").trim() && !websiteUrl) return fail("The edition website must be a valid HTTPS URL.");
  const proceedingsDoi = readFormValue(formData, "proceedingsDoi").trim() || null;
  if (proceedingsDoi && !/^10\.\d{4,9}\/\S+$/i.test(proceedingsDoi)) return fail("Enter a valid proceedings DOI.");
  const coverImageUrl = readOptionalUrl(formData, "coverImageUrl");
  if (readFormValue(formData, "coverImageUrl").trim() && !coverImageUrl) return fail("The edition cover must be a valid HTTPS URL.");
  const timezone = readOptionalTimezone(formData, "timezone");
  if (readFormValue(formData, "timezone").trim() && !timezone) return fail("Enter a valid IANA timezone, such as Asia/Kolkata.");
  const startsAt = readOptionalIsoDate(formData, "startsAt");
  const endsAt = readOptionalIsoDate(formData, "endsAt");
  if (startsAt && endsAt && endsAt < startsAt) return fail("The end date cannot be before the start date.");
  const promoted = await promoteContentImages({ coverKind: "conference-cover", imageUrl: coverImageUrl, html: "", userId: auth.user.id });
  if (!promoted.ok) return fail(promoted.error);
  await prisma.conferenceEdition.update({ where: { id: edition.id }, data: {
    status: nextStatus, isPublished, startsAt, endsAt,
    location: readFormValue(formData, "location").trim() || null,
    timezone, websiteUrl,
    cfpOpenAt: readOptionalIsoDate(formData, "cfpOpenAt"),
    submissionDeadline: readOptionalIsoDate(formData, "submissionDeadline"),
    notificationAt: readOptionalIsoDate(formData, "notificationAt"),
    cameraReadyAt: readOptionalIsoDate(formData, "cameraReadyAt"), proceedingsDoi, coverImageUrl: promoted.coverUrl,
  } });
  revalidatePath("/workspace/editorial/settings");
  revalidatePath(`/sbc/${edition.venue.slug}`);
  return { success: true, message: "Edition status saved." };
}

export async function createConferenceProgramItemAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);
  const editionId = readFormValue(formData, "editionId");
  const edition = await prisma.conferenceEdition.findUnique({ where: { id: editionId }, select: { id: true, venueId: true, slug: true, venue: { select: { slug: true } } } });
  if (!edition) return fail("That conference edition no longer exists.");
  const [admin, role] = await Promise.all([
    isUserAdmin(auth.user.id),
    prisma.editorialRole.findFirst({ where: { userId: auth.user.id, venueId: edition.venueId, roleTitle: { in: ["EDITOR_IN_CHIEF", "TRACK_CHAIR"] } }, select: { id: true } }),
  ]);
  if (!admin && !role) return fail("Only the conference editorial team can manage the program.");
  const type = readFormValue(formData, "type");
  const allowed = ["KEYNOTE", "INVITED_TALK", "PAPER", "POSTER", "WORKSHOP", "BREAK", "OTHER"] as const;
  if (!allowed.includes(type as (typeof allowed)[number])) return fail("Choose a valid program item type.");
  const title = readFormValue(formData, "title").trim();
  if (!title || title.length > 200) return fail("Add a program title up to 200 characters.");
  const externalUrl = readOptionalUrl(formData, "externalUrl");
  if (readFormValue(formData, "externalUrl").trim() && !externalUrl) return fail("The program link must be a valid HTTPS URL.");
  const startsAt = readOptionalIsoDate(formData, "startsAt");
  const endsAt = readOptionalIsoDate(formData, "endsAt");
  if (startsAt && endsAt && endsAt < startsAt) return fail("The program item cannot end before it starts.");
  await prisma.conferenceProgramItem.create({ data: {
    editionId, type: type as (typeof allowed)[number], title,
    description: readFormValue(formData, "description").trim() || null,
    speakers: readFormValue(formData, "speakers").trim() || null,
    track: readFormValue(formData, "track").trim() || null,
    room: readFormValue(formData, "room").trim() || null,
    startsAt, endsAt, externalUrl,
    sortOrder: Number(readFormValue(formData, "sortOrder")) || 0,
  } });
  revalidatePath("/workspace/editorial/settings");
  revalidatePath(`/sbc/${edition.venue.slug}/${edition.slug}`);
  return { success: true, message: "Program item added." };
}

export async function createJournalIssueAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);
  const venueId = readFormValue(formData, "venueId");
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, slug: true, type: true } });
  if (!venue || venue.type !== "JOURNAL") return fail("Choose a journal venue.");
  const [admin, role] = await Promise.all([
    isUserAdmin(auth.user.id),
    prisma.editorialRole.findFirst({ where: { userId: auth.user.id, venueId, roleTitle: "EDITOR_IN_CHIEF" }, select: { id: true } }),
  ]);
  if (!admin && !role) return fail("Only the journal Editor-in-Chief can create an issue.");
  const volume = Number(readFormValue(formData, "volume"));
  const number = Number(readFormValue(formData, "number"));
  const title = readFormValue(formData, "title").trim();
  const description = sanitizeRichHtml(readFormValue(formData, "description"));
  const publicationDate = readOptionalIsoDate(formData, "publicationDate");
  const coverImageUrl = readOptionalUrl(formData, "coverImageUrl");
  const doi = readFormValue(formData, "doi").trim() || null;
  if (!Number.isInteger(volume) || volume < 1 || !Number.isInteger(number) || number < 1) return fail("Volume and issue number must be positive whole numbers.");
  if (title.length > 160) return fail("Issue title must be 160 characters or fewer.");
  try { assertRichTextWithinLimit(description, 4000, "Issue description"); } catch (error) { return fail(error instanceof Error ? error.message : "Issue description is too long."); }
  if (readFormValue(formData, "coverImageUrl").trim() && !coverImageUrl) return fail("The cover image must be a valid HTTPS URL.");
  if (doi && !/^10\.\d{4,9}\/\S+$/i.test(doi)) return fail("Enter a valid issue DOI.");
  try {
    await prisma.journalIssue.create({ data: { venueId, volume, number, title: title || null, description: description || null, publicationDate, coverImageUrl, doi, status: "DRAFT" } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") return fail("That journal issue already exists.");
    throw error;
  }
  revalidatePath("/workspace/editorial/settings");
  revalidatePath(`/sbj/${venue.slug}/archive`);
  return { success: true, message: `Volume ${volume}, issue ${number} was created.` };
}

export async function updateJournalIssueAction(
  _previous: VenueActionResult,
  formData: FormData,
): Promise<VenueActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);
  const issueId = readFormValue(formData, "issueId");
  const status = readFormValue(formData, "status");
  const allowed = ["DRAFT", "OPEN", "LOCKED", "PUBLISHED", "ARCHIVED"] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) return fail("Choose a valid issue status.");
  if (status === "DRAFT" && readFormValue(formData, "isPublished") === "true") return fail("A draft issue cannot be public. Open or publish it first.");
  const issue = await prisma.journalIssue.findUnique({ where: { id: issueId }, select: { id: true, venueId: true, venue: { select: { slug: true } } } });
  if (!issue) return fail("That issue no longer exists.");
  const [admin, role] = await Promise.all([
    isUserAdmin(auth.user.id),
    prisma.editorialRole.findFirst({ where: { userId: auth.user.id, venueId: issue.venueId, roleTitle: "EDITOR_IN_CHIEF" }, select: { id: true } }),
  ]);
  if (!admin && !role) return fail("Only the journal Editor-in-Chief can update an issue.");
  const isPublished = readFormValue(formData, "isPublished") === "true";
  const title = readFormValue(formData, "title").trim();
  const description = sanitizeRichHtml(readFormValue(formData, "description"));
  const publicationDate = readOptionalIsoDate(formData, "publicationDate");
  const coverImageUrl = readOptionalUrl(formData, "coverImageUrl");
  const doi = readFormValue(formData, "doi").trim() || null;
  try { assertRichTextWithinLimit(description, 4000, "Issue description"); } catch (error) { return fail(error instanceof Error ? error.message : "Issue description is too long."); }
  if (readFormValue(formData, "coverImageUrl").trim() && !coverImageUrl) return fail("The cover image must be a valid HTTPS URL.");
  if (doi && !/^10\.\d{4,9}\/\S+$/i.test(doi)) return fail("Enter a valid issue DOI.");
  const promoted = await promoteContentImages({ coverKind: "journal-cover", imageUrl: coverImageUrl, html: description, userId: auth.user.id });
  if (!promoted.ok) return fail(promoted.error);
  await prisma.journalIssue.update({ where: { id: issue.id }, data: { status: status as (typeof allowed)[number], isPublished, title: title || null, description: description || null, publicationDate, coverImageUrl: promoted.coverUrl, doi } });
  revalidatePath("/workspace/editorial/settings");
  revalidatePath(`/sbj/${issue.venue.slug}`);
  revalidatePath(`/sbj/${issue.venue.slug}/archive`);
  return { success: true, message: "Issue status saved." };
}

function readBounded(formData: FormData, key: string, max: number, label: string): string | null {
  return readOptionalShortText(formData, key, max, label);
}

const VENUE_TYPES = ["JOURNAL", "CONFERENCE"] as const;
const ROLE_TITLES: readonly EditorialRoleTitle[] = [
  "EDITOR_IN_CHIEF",
  "TRACK_CHAIR",
  "ASSOC_EDITOR",
];

function readOptionalIsoDate(formData: FormData, key: string): Date | null {
  const value = readFormValue(formData, key).trim();
  if (!value) return null;
  const date = new Date(value.includes("T") ? `${value}:00Z` : `${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readOptionalUrl(formData: FormData, key: string): string | null {
  const value = readFormValue(formData, key).trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readOptionalTimezone(formData: FormData, key: string): string | null {
  const value = readFormValue(formData, key).trim();
  if (!value) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return null;
  }
}

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
  const coverImageUrl = readOptionalUrl(formData, "coverImageUrl");

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
  if (readFormValue(formData, "coverImageUrl").trim() && !coverImageUrl) return fail("The venue cover must be a valid HTTPS URL.");

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
      coverImageUrl,
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
      coverImageUrl: true,
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

  let coverImageUrl = venue.coverImageUrl;
  if (published && coverImageUrl) {
    const promoted = await promoteContentImages({ coverKind: "venue-cover", imageUrl: coverImageUrl, html: "", userId: admin.id });
    if (!promoted.ok) return fail(promoted.error);
    coverImageUrl = promoted.coverUrl;
  }

  await prisma.venue.update({
    where: { id: venue.id },
    data: {
      isPublished: published,
      launchedAt: published ? new Date() : null,
      coverImageUrl,
    },
  });

  // Tell the people who run the venue when its public state changes; an
  // editor should not discover an unpublish by refreshing the site.
  if (published !== venue.isPublished) {
    const editors = await prisma.editorialRole.findMany({
      where: { venueId: venue.id },
      select: { userId: true },
    });
    await Promise.all(
      [...new Set(editors.map((editor) => editor.userId))].map((recipientId) =>
        notifyUserById({
          recipientId,
          actorId: admin.id,
          type: published ? "venue-published" : "venue-unpublished",
          targetType: "editorial",
          targetId: venue.id,
          title: published
            ? `${venue.name} is now public`
            : `${venue.name} was unpublished`,
          body: published
            ? `${venue.name} can now be indexed and is accepting submissions.`
            : `${venue.name} is no longer publicly visible. Contact the platform administrator before relying on it.`,
        }),
      ),
    );
  }

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

  // The new editor should learn about the responsibility without being told
  // out of band. `notifyUserById` skips when an admin grants themselves.
  await notifyUserById({
    recipientId: user.id,
    actorId: admin.id,
    type: "editorial-role-granted",
    targetType: "editorial",
    targetId: venueId,
    title: `You now edit ${venue.name}`,
    body: `You were granted the ${EDITORIAL_ROLE_LABELS[roleTitle]} role. The editorial desk and venue settings are in your workspace.`,
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
  const coverImageUrl = readOptionalUrl(formData, "coverImageUrl");
  if (readFormValue(formData, "coverImageUrl").trim() && !coverImageUrl) return fail("The venue cover must be a valid HTTPS URL.");

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

  const promoted = await promoteContentImages({ coverKind: "venue-cover", imageUrl: coverImageUrl, html: "", userId: user.id });
  if (!promoted.ok) return fail(promoted.error);

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
          coverImageUrl: promoted.coverUrl,
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
