"use server";

import { z } from "zod";
import { getCurrentUser, isUserAdmin } from "@/lib/auth";
import {
  assignOutreachVariants,
  DEFAULT_SCHOLAR_OUTREACH_VARIANT,
  pickScholarOutreachVariant,
} from "@/lib/emails/scholarInvite";
import {
  claimOutreachSendSlot,
  deliverOutreachEmail,
  outreachSkipReason,
  type OutreachSendCandidate,
} from "@/lib/outreach/sender";
import { normalizeEmail, validateEmailFormat } from "@/lib/email-normalizer";
import {
  MAX_OUTREACH_IMPORT_ROWS,
  parseOutreachCsv,
  type OutreachImportParse,
  type OutreachImportRow,
} from "@/lib/outreach/import";
import { parseOutreachWorkbook } from "@/lib/outreach/import-file";
import {
  MAX_OUTREACH_BATCH_SIZE,
  MAX_OUTREACH_EMAIL,
  MAX_OUTREACH_INSTITUTION,
  MAX_OUTREACH_NAME,
  MAX_OUTREACH_NOTES,
  MAX_OUTREACH_ROLE,
  MAX_OUTREACH_SOURCE,
} from "@/lib/constants";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import prisma from "@/lib/db";

const createOutreachContactSchema = z.object({
  name: z.string().trim().min(1).max(MAX_OUTREACH_NAME),
  email: z.string().trim().min(3).max(MAX_OUTREACH_EMAIL),
  institution: z.string().trim().max(MAX_OUTREACH_INSTITUTION).optional().default(""),
  role: z.string().trim().max(MAX_OUTREACH_ROLE).optional().default(""),
  source: z.string().trim().max(MAX_OUTREACH_SOURCE).optional().default(""),
  notes: z.string().trim().max(MAX_OUTREACH_NOTES).optional().default(""),
});

export type CreateOutreachContactPayload = z.input<typeof createOutreachContactSchema>;

type CreateOutreachContactResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string };

export async function createOutreachContact(
  payload: CreateOutreachContactPayload,
): Promise<CreateOutreachContactResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return { success: false, error: "You are not authorized to manage outreach contacts." };
  }

  const parsed = createOutreachContactSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Please check the form fields.",
    };
  }

  const data = parsed.data;
  const email = normalizeEmail(data.email);
  if (!validateEmailFormat(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  // Never create a contact for an address that has already opted out.
  const unsubscribed = await prisma.outreachEmailUnsubscribe.findUnique({
    where: { email },
    select: { id: true },
  });

  // Idempotent: one row per email. Upsert so re-adding the same contact
  // refreshes the fields instead of duplicating.
  const existing = await prisma.outreach.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  if (unsubscribed && !existing) {
    return {
      success: false,
      error: "This email has opted out of outreach and cannot be added.",
    };
  }

  const status = unsubscribed ? "UNSUBSCRIBED" : "PENDING";

  if (existing && existing.status === "UNSUBSCRIBED") {
    return {
      success: false,
      error: "This email has opted out of outreach and cannot be added.",
    };
  }

  let contact;
  if (existing) {
    contact = await prisma.outreach.update({
      where: { email },
      data: {
        name: data.name,
        institution: data.institution || null,
        role: data.role || null,
        source: data.source || null,
        notes: data.notes || null,
        status,
        updatedAt: new Date(),
      },
      select: { id: true },
    });
  } else {
    contact = await prisma.outreach.create({
      data: {
        name: data.name,
        email,
        institution: data.institution || null,
        role: data.role || null,
        source: data.source || null,
        notes: data.notes || null,
        status,
        createdById: currentUser.id,
      },
      select: { id: true },
    });
  }

  return { success: true, data: { id: contact.id } };
}

/** 4 MB sits comfortably under the 6 MB Server Action body limit. */
const MAX_OUTREACH_IMPORT_FILE_BYTES = 4 * 1024 * 1024;
const IMPORT_FILE_EXTENSIONS = new Set(["csv", "tsv", "txt", "xlsx", "xlsm"]);

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

type PreviewOutreachImportResult =
  | {
      success: true;
      data: { fileName: string; rows: OutreachImportRow[] };
    }
  | { success: false; error: string };

/**
 * Parse an uploaded CSV/TSV/XLSX file into outreach rows.
 *
 * Parsing happens on the server so `exceljs` never enters the admin bundle and
 * both formats share one code path. The preview is read-only: nothing is
 * persisted until the admin confirms with {@link importOutreachContacts}.
 */
export async function previewOutreachImport(
  formData: FormData,
): Promise<PreviewOutreachImportResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return {
      success: false,
      error: "You are not authorized to manage outreach contacts.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a CSV or Excel file to import." };
  }

  if (file.size > MAX_OUTREACH_IMPORT_FILE_BYTES) {
    return {
      success: false,
      error: "That file is larger than 4 MB. Split it into smaller files.",
    };
  }

  const extension = fileExtension(file.name);
  if (!IMPORT_FILE_EXTENSIONS.has(extension)) {
    return {
      success: false,
      error:
        extension === "xls"
          ? "Legacy .xls files are not supported. Save the sheet as .xlsx or CSV."
          : "Unsupported file type. Upload a .csv, .tsv, or .xlsx file.",
    };
  }

  let parsed: OutreachImportParse;

  try {
    parsed =
      extension === "xlsx" || extension === "xlsm"
        ? await parseOutreachWorkbook(await file.arrayBuffer())
        : parseOutreachCsv(await file.text());
  } catch {
    return {
      success: false,
      error: "Could not read that file. Re-export it and try again.",
    };
  }

  if (parsed.error) {
    return { success: false, error: parsed.error };
  }

  if (parsed.rows.length > MAX_OUTREACH_IMPORT_ROWS) {
    return {
      success: false,
      error: `This file has ${parsed.rows.length} rows; the limit is ${MAX_OUTREACH_IMPORT_ROWS}. Split it into smaller files.`,
    };
  }

  return {
    success: true,
    data: { fileName: file.name, rows: parsed.rows },
  };
}

const importOutreachContactsSchema = z.object({
  rows: z
    .array(createOutreachContactSchema)
    .min(1)
    .max(MAX_OUTREACH_IMPORT_ROWS),
});

export type ImportOutreachContactsPayload = z.input<
  typeof importOutreachContactsSchema
>;

type ImportOutreachContactsResult =
  | {
      success: true;
      data: { created: number; updated: number; skipped: number };
    }
  | { success: false; error: string };

/**
 * Persist a parsed batch in two queries plus chunked writes, instead of the
 * per-row Server Action round trip the first importer used.
 *
 * Existing contacts keep their status and send history: re-importing a sheet is
 * a way to refresh names/details, not to reset someone to PENDING and risk a
 * second cold email.
 */
export async function importOutreachContacts(
  payload: ImportOutreachContactsPayload,
): Promise<ImportOutreachContactsResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return {
      success: false,
      error: "You are not authorized to manage outreach contacts.",
    };
  }

  const parsed = importOutreachContactsSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Please check the imported rows.",
    };
  }

  const rateLimit = await checkRateLimit({
    namespace: "admin:outreach:import",
    key: currentUser.id,
    limit: 30,
    window: "1 h",
    onDegraded: "closed",
  });

  if (rateLimit.degraded) {
    return {
      success: false,
      error:
        "Request protection is temporarily unavailable. Please try again later.",
    };
  }

  if (!rateLimit.allowed) {
    return { success: false, error: RATE_LIMIT_ERROR };
  }

  // Re-validate and collapse duplicates at the boundary: the preview is not a
  // security boundary, and one bad row must never fail the batch.
  const rowsByEmail = new Map<string, z.infer<typeof createOutreachContactSchema>>();

  for (const row of parsed.data.rows) {
    const email = normalizeEmail(row.email);
    if (!validateEmailFormat(email)) continue;
    if (rowsByEmail.has(email)) continue;
    rowsByEmail.set(email, { ...row, email });
  }

  if (rowsByEmail.size === 0) {
    return {
      success: false,
      error: "None of the rows had a valid email address.",
    };
  }

  const emails = [...rowsByEmail.keys()];

  const [unsubscribed, existing] = await Promise.all([
    prisma.outreachEmailUnsubscribe.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
    prisma.outreach.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, status: true },
    }),
  ]);

  const blockedEmails = new Set(unsubscribed.map((entry) => entry.email));
  const existingByEmail = new Map(
    existing.map((contact) => [contact.email, contact]),
  );

  const creates: Array<{
    name: string;
    email: string;
    institution: string | null;
    role: string | null;
    source: string | null;
    notes: string | null;
    status: "PENDING";
    createdById: string;
  }> = [];

  const updates: Array<{
    id: string;
    name: string;
    institution: string | null;
    role: string | null;
    source: string | null;
    notes: string | null;
  }> = [];

  for (const [email, row] of rowsByEmail) {
    if (blockedEmails.has(email)) continue;

    const current = existingByEmail.get(email);
    if (current?.status === "UNSUBSCRIBED") continue;

    const fields = {
      name: row.name,
      institution: row.institution || null,
      role: row.role || null,
      source: row.source || "file-import",
      notes: row.notes || null,
    };

    if (current) updates.push({ id: current.id, ...fields });
    else {
      creates.push({
        ...fields,
        email,
        status: "PENDING",
        createdById: currentUser.id,
      });
    }
  }

  try {
    if (creates.length > 0) {
      await prisma.outreach.createMany({ data: creates, skipDuplicates: true });
    }

    // Chunked so a 1000-row import never holds one giant transaction.
    const UPDATE_CHUNK_SIZE = 100;
    for (let index = 0; index < updates.length; index += UPDATE_CHUNK_SIZE) {
      const chunk = updates.slice(index, index + UPDATE_CHUNK_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const update of chunk) {
          await tx.outreach.update({
            where: { id: update.id },
            data: {
              name: update.name,
              institution: update.institution,
              role: update.role,
              source: update.source,
              notes: update.notes,
            },
          });
        }
      });
    }
  } catch {
    return {
      success: false,
      error: "Could not import contacts. Please try again.",
    };
  }

  return {
    success: true,
    data: {
      created: creates.length,
      updated: updates.length,
      skipped: parsed.data.rows.length - creates.length - updates.length,
    },
  };
}

const updateOutreachContactSchema = z.object({
  contactId: z.string().min(1),
  name: z.string().trim().min(1).max(MAX_OUTREACH_NAME),
  email: z.string().trim().min(3).max(MAX_OUTREACH_EMAIL),
  institution: z.string().trim().max(MAX_OUTREACH_INSTITUTION).optional().default(""),
  role: z.string().trim().max(MAX_OUTREACH_ROLE).optional().default(""),
  source: z.string().trim().max(MAX_OUTREACH_SOURCE).optional().default(""),
  notes: z.string().trim().max(MAX_OUTREACH_NOTES).optional().default(""),
});

export type UpdateOutreachContactPayload = z.input<
  typeof updateOutreachContactSchema
>;

type UpdateOutreachContactResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string };

export async function updateOutreachContact(
  payload: UpdateOutreachContactPayload,
): Promise<UpdateOutreachContactResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return {
      success: false,
      error: "You are not authorized to manage outreach contacts.",
    };
  }

  const parsed = updateOutreachContactSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Please check the form fields.",
    };
  }

  const data = parsed.data;
  const email = normalizeEmail(data.email);
  if (!validateEmailFormat(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const contact = await prisma.outreach.findUnique({
    where: { id: data.contactId },
    select: { id: true, email: true, status: true },
  });

  if (!contact) {
    return { success: false, error: "Outreach contact not found." };
  }

  const emailChanged = email !== contact.email;

  if (emailChanged) {
    const [unsubscribed, duplicate] = await Promise.all([
      prisma.outreachEmailUnsubscribe.findUnique({
        where: { email },
        select: { id: true },
      }),
      prisma.outreach.findUnique({
        where: { email },
        select: { id: true },
      }),
    ]);

    if (unsubscribed) {
      return {
        success: false,
        error: "This email has opted out of outreach and cannot be added.",
      };
    }

    if (duplicate && duplicate.id !== contact.id) {
      return {
        success: false,
        error: "Another outreach contact already uses this email.",
      };
    }
  }

  try {
    await prisma.outreach.update({
      where: { id: contact.id },
      data: {
        name: data.name,
        email,
        institution: data.institution || null,
        role: data.role || null,
        source: data.source || null,
        notes: data.notes || null,
        // The old address opted out, not the replacement one.
        ...(emailChanged && contact.status === "UNSUBSCRIBED"
          ? { status: "PENDING" as const }
          : {}),
        updatedAt: new Date(),
      },
      select: { id: true },
    });
  } catch {
    return {
      success: false,
      error: "Could not update this contact. Please try again.",
    };
  }

  return { success: true, data: { id: contact.id } };
}

const listOutreachContactsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  status: z.enum(["PENDING", "OUTREACHED", "BOUNCED", "REPLIED", "UNSUBSCRIBED", "all"]).default("all"),
  search: z.string().trim().optional().default(""),
});

export type ListOutreachContactsPayload = z.input<typeof listOutreachContactsSchema>;

export type OutreachContactItem = {
  id: string;
  name: string;
  email: string;
  institution: string | null;
  role: string | null;
  source: string | null;
  notes: string | null;
  status: string;
  sendCount: number;
  outreachedAt: Date | null;
  emailSentAt: Date | null;
  createdAt: Date;
  createdByName: string | null;
  linkedUserId: string | null;
};

export type ListOutreachContactsResult = {
  items: OutreachContactItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listOutreachContacts(
  payload: ListOutreachContactsPayload,
): Promise<ListOutreachContactsResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 };
  }

  const parsed = listOutreachContactsSchema.safeParse(payload);
  if (!parsed.success) {
    return { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 };
  }

  const { page, pageSize, status, search } = parsed.data;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (status !== "all") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { institution: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.outreach.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        institution: true,
        role: true,
        source: true,
        notes: true,
        status: true,
        sendCount: true,
        outreachedAt: true,
        emailSentAt: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        user: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.outreach.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      institution: item.institution,
      role: item.role,
      source: item.source,
      notes: item.notes,
      status: item.status,
      sendCount: item.sendCount,
      outreachedAt: item.outreachedAt,
      emailSentAt: item.emailSentAt,
      createdAt: item.createdAt,
      createdByName: item.createdBy?.name ?? null,
      linkedUserId: item.user?.id ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

const sendOutreachEmailSchema = z.object({
  contactId: z.string().min(1),
  /** Allow re-sending to a contact that was already emailed. */
  resend: z.boolean().optional().default(false),
});

export type SendOutreachEmailPayload = z.input<typeof sendOutreachEmailSchema>;

type SendOutreachEmailResult =
  | { success: true; data: { id: string; status: string; emailSentAt: Date | null } }
  | { success: false; error: string };

export async function sendOutreachEmail(
  payload: SendOutreachEmailPayload,
): Promise<SendOutreachEmailResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return { success: false, error: "You are not authorized to send outreach emails." };
  }

  const parsed = sendOutreachEmailSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid contact id.",
    };
  }

  const { contactId, resend } = parsed.data;

  // Load the contact; no join needed, the sender is always the team.
  const contact = await prisma.outreach.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      sendCount: true,
      userId: true,
    },
  });

  if (!contact) {
    return { success: false, error: "Outreach contact not found." };
  }

  // Respect the global unsubscribe list, and never cold-email an address that
  // already has a ScholarBase account.
  const [unsubscribed, existingMember] = await Promise.all([
    prisma.outreachEmailUnsubscribe.findUnique({
      where: { email: contact.email },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { email: contact.email, isDeleted: false },
      select: { id: true },
    }),
  ]);

  const skipReason = outreachSkipReason(contact, {
    resend,
    optedOut: unsubscribed !== null,
    member: contact.userId !== null || existingMember !== null,
  });

  if (skipReason) {
    if (unsubscribed) {
      await prisma.outreach.update({
        where: { id: contactId },
        data: { status: "UNSUBSCRIBED" },
      });
    }

    return { success: false, error: skipReason };
  }

  // Only a contact that passed every eligibility rule spends a rate-limit slot.
  const slot = await claimOutreachSendSlot(currentUser.id);
  if (!slot.allowed) {
    return { success: false, error: slot.error };
  }


  // Rotate the shared template library: the email picks a stable variant and
  // advances to the next one on every resend.
  const variant = pickScholarOutreachVariant(contact.email, contact.sendCount);

  return deliverOutreachEmail(contact, variant);
}

const sendOutreachBatchSchema = z.object({
  contactIds: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_OUTREACH_BATCH_SIZE),
  /** Allow re-sending to already-contacted recipients. */
  resend: z.boolean().optional().default(false),
});

export type SendOutreachBatchPayload = z.input<typeof sendOutreachBatchSchema>;

export type OutreachBatchResultItem = {
  id: string;
  name: string;
  email: string;
  status: "sent" | "skipped" | "failed";
  error?: string;
};

type SendOutreachBatchResult =
  | {
      success: true;
      data: {
        sent: number;
        skipped: number;
        failed: number;
        results: OutreachBatchResultItem[];
      };
    }
  | { success: false; error: string };

/**
 * Send the outreach email to several contacts in one action.
 *
 * Each recipient gets a different template: the variant library is shuffled
 * once per batch, because a per-recipient pick would still produce duplicates.
 * Skips are reported per contact, and only delivered emails are recorded, so a
 * partial failure leaves the rest PENDING.
 */
export async function sendOutreachBatch(
  payload: SendOutreachBatchPayload,
): Promise<SendOutreachBatchResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return { success: false, error: "You are not authorized to send outreach emails." };
  }

  const parsed = sendOutreachBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: `Select between 1 and ${MAX_OUTREACH_BATCH_SIZE} contacts.`,
    };
  }

  const { resend } = parsed.data;
  const contactIds = [...new Set(parsed.data.contactIds)];

  if (contactIds.length === 0) {
    return { success: false, error: "Select at least one contact." };
  }

  const contacts = await prisma.outreach.findMany({
    where: { id: { in: contactIds } },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      sendCount: true,
      userId: true,
    },
  });

  const contactsById = new Map(
    contacts.map((contact) => [contact.id, contact]),
  );
  const ordered = contactIds.flatMap((id) => {
    const contact = contactsById.get(id);
    return contact ? [contact] : [];
  });

  if (ordered.length === 0) {
    return { success: false, error: "Contact not found." };
  }

  const unsubscribed = await prisma.outreachEmailUnsubscribe.findMany({
    where: { email: { in: ordered.map((contact) => contact.email) } },
    select: { email: true },
  });
  const optedOutEmails = new Set(unsubscribed.map((entry) => entry.email));

  // A contact who already has an account should get product email, never cold
  // outreach. One indexed lookup for the whole batch.
  const members = await prisma.user.findMany({
    where: {
      email: { in: ordered.map((contact) => contact.email) },
      isDeleted: false,
    },
    select: { email: true },
  });
  const memberEmails = new Set(members.map((entry) => entry.email));

  const results: OutreachBatchResultItem[] = [];
  const pending: OutreachSendCandidate[] = [];
  const optedOutIds: string[] = [];

  for (const contact of ordered) {
    const optedOut = optedOutEmails.has(contact.email);
    // A batch send is PENDING-only; anything already contacted needs the
    // explicit resend mode. The single-row action keeps its own history-aware
    // rule, while the UI only ever offers Send on pending rows.
    const skipReason =
      !resend && contact.status !== "PENDING"
        ? "Only pending contacts can be sent. Use resend for already-contacted recipients."
        : outreachSkipReason(contact, {
            resend,
            optedOut,
            member: contact.userId !== null || memberEmails.has(contact.email),
          });

    if (skipReason) {
      results.push({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        status: "skipped",
        error: skipReason,
      });
      if (optedOut) optedOutIds.push(contact.id);
      continue;
    }

    pending.push(contact);
  }

  // Mirror the single send: an address on the unsubscribe list is marked
  // unsubscribed in the contact list too.
  if (optedOutIds.length > 0) {
    await prisma.outreach.updateMany({
      where: { id: { in: optedOutIds } },
      data: { status: "UNSUBSCRIBED" },
    });
  }

  // One shuffled pool per batch, so no two recipients get the same copy.
  const variants = assignOutreachVariants(pending.length);

  let blockedError: string | null = null;

  for (let index = 0; index < pending.length; index += 1) {
    const contact = pending[index]!;

    // Once the limiter blocks (or Redis is down), the rest of the batch cannot
    // send either; report them without touching the provider.
    if (blockedError === null) {
      const slot = await claimOutreachSendSlot(currentUser.id);
      if (!slot.allowed) blockedError = slot.error;
    }

    if (blockedError !== null) {
      results.push({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        status: "failed",
        error: blockedError,
      });
      continue;
    }

    const delivery = await deliverOutreachEmail(
      contact,
      variants[index] ?? DEFAULT_SCHOLAR_OUTREACH_VARIANT,
    );

    results.push(
      delivery.success
        ? {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            status: "sent",
          }
        : {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            status: "failed",
            error: delivery.error,
          },
    );
  }

  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const skipped = results.filter((result) => result.status === "skipped").length;

  if (sent === 0 && failed > 0) {
    return {
      success: false,
      error: blockedError ?? "Could not send any emails. Please try again.",
    };
  }

  return { success: true, data: { sent, skipped, failed, results } };
}

const markOutreachStatusSchema = z.object({
  contactId: z.string().min(1),
  status: z.enum(["PENDING", "OUTREACHED", "BOUNCED", "REPLIED", "UNSUBSCRIBED"]),
});

export type MarkOutreachStatusPayload = z.input<typeof markOutreachStatusSchema>;

type MarkOutreachStatusResult =
  | { success: true; data: { id: string; status: string } }
  | { success: false; error: string };

export async function markOutreachStatus(
  payload: MarkOutreachStatusPayload,
): Promise<MarkOutreachStatusResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return { success: false, error: "You are not authorized to update outreach contacts." };
  }

  const parsed = markOutreachStatusSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid request.",
    };
  }

  const { contactId, status } = parsed.data;

  const contact = await prisma.outreach.findUnique({
    where: { id: contactId },
    select: { id: true, email: true, status: true },
  });

  if (!contact) {
    return { success: false, error: "Outreach contact not found." };
  }

  if (contact.status === status) {
    return { success: true, data: { id: contact.id, status: contact.status } };
  }

  // Reviving a contact is the only status change that implies reachability.
  // The recipient's own opt-out list always wins, whichever action asks.
  if (status === "PENDING") {
    const optedOut = await prisma.outreachEmailUnsubscribe.findUnique({
      where: { email: contact.email },
      select: { id: true },
    });

    if (optedOut) {
      return {
        success: false,
        error:
          "This address unsubscribed through the email link, so it has to stay unsubscribed.",
      };
    }
  }

  const data: Record<string, unknown> = { status };
  if (status === "REPLIED") {
    data.emailSentAt = new Date();
  }

  const updated = await prisma.outreach.update({
    where: { id: contactId },
    data,
    select: { id: true, status: true },
  });

  return { success: true, data: { id: updated.id, status: updated.status } };
}

const resubscribeOutreachContactSchema = z.object({
  contactId: z.string().min(1),
});

export type ResubscribeOutreachContactPayload = z.input<
  typeof resubscribeOutreachContactSchema
>;

type ResubscribeOutreachContactResult =
  | { success: true; data: { id: string; status: string } }
  | { success: false; error: string };

/**
 * Undo an opt-out that an admin recorded by hand (the "Mark unsubscribed" menu
 * item, which only changes the contact's status).
 *
 * The recipient's own unsubscribe always wins: `OutreachEmailUnsubscribe` is
 * written by the unsubscribe link in the email, is never deleted here, and
 * blocks reviving the contact. Only a contact whose address is absent from that
 * list can be made reachable again.
 *
 * The status is not always PENDING: a contact that was already emailed keeps
 * that history (`sendCount`), so reviving them as PENDING would show "Pending —
 * 2 sends". They are restored to OUTREACHED instead, which is also the correct
 * menu (Resend, not Send). The exact pre-opt-out status (BOUNCED/REPLIED) is not
 * stored separately, so "already contacted" is the best truthful baseline.
 */
export async function resubscribeOutreachContact(
  payload: ResubscribeOutreachContactPayload,
): Promise<ResubscribeOutreachContactResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return {
      success: false,
      error: "You are not authorized to update outreach contacts.",
    };
  }

  const parsed = resubscribeOutreachContactSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: "Invalid contact id." };
  }

  const contact = await prisma.outreach.findUnique({
    where: { id: parsed.data.contactId },
    select: { id: true, email: true, status: true, sendCount: true },
  });

  if (!contact) {
    return { success: false, error: "Outreach contact not found." };
  }

  if (contact.status !== "UNSUBSCRIBED") {
    // Idempotent: the row is already reachable, nothing to change.
    return {
      success: true,
      data: { id: contact.id, status: contact.status },
    };
  }

  const optedOut = await prisma.outreachEmailUnsubscribe.findUnique({
    where: { email: contact.email },
    select: { id: true },
  });

  if (optedOut) {
    return {
      success: false,
      error:
        "This address unsubscribed through the email link, so it has to stay unsubscribed.",
    };
  }

  const updated = await prisma.outreach.update({
    where: { id: contact.id },
    data: { status: contact.sendCount > 0 ? "OUTREACHED" : "PENDING" },
    select: { id: true, status: true },
  });

  return { success: true, data: { id: updated.id, status: updated.status } };
}

const deleteOutreachContactSchema = z.object({
  contactId: z.string().min(1),
});

export type DeleteOutreachContactPayload = z.input<typeof deleteOutreachContactSchema>;

type DeleteOutreachContactResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string };

export async function deleteOutreachContact(
  payload: DeleteOutreachContactPayload,
): Promise<DeleteOutreachContactResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser || !(await isUserAdmin(currentUser.id))) {
    return { success: false, error: "You are not authorized to delete outreach contacts." };
  }

  const parsed = deleteOutreachContactSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid contact id.",
    };
  }

  const { contactId } = parsed.data;

  const contact = await prisma.outreach.findUnique({
    where: { id: contactId },
    select: { id: true },
  });

  if (!contact) {
    return { success: false, error: "Outreach contact not found." };
  }

  await prisma.outreach.delete({
    where: { id: contactId },
  });

  return { success: true, data: { id: contact.id } };
}
