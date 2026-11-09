import type { OutreachContactItem } from "@/app/actions/outreach";

/**
 * Client-side cache helpers for the admin outreach list.
 *
 * `createOutreachContact` upserts by email, so an optimistic insert must do the
 * same: refresh an existing row instead of duplicating it. New rows are given a
 * temporary id and reconciled with the persisted id when the action returns.
 */

export const OUTREACH_QUERY_KEY = ["admin-outreach"] as const;

/**
 * One cache entry per page. `OUTREACH_QUERY_KEY` stays the prefix, so
 * `invalidateQueries({ queryKey: OUTREACH_QUERY_KEY })` purges every page while
 * row-level optimistic patches target exactly the page on screen.
 */
export function outreachQueryKey(page: number) {
  return [...OUTREACH_QUERY_KEY, page] as const;
}

const OPTIMISTIC_ID_PREFIX = "optimistic-";

export type OutreachListData = {
  items: OutreachContactItem[];
  total: number;
};

export type OutreachContactDraft = {
  name: string;
  email: string;
  institution?: string | null;
  role?: string | null;
  source?: string | null;
  notes?: string | null;
};

export function createOptimisticOutreachId(): string {
  return `${OPTIMISTIC_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isOptimisticOutreachId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Insert (or refresh) the contact locally, mirroring the server's upsert. */
export function addOutreachContactOptimistically(
  data: OutreachListData | undefined,
  draft: OutreachContactDraft,
  optimisticId: string,
  options: {
    /**
     * Keep an existing row's status/send history. Bulk imports refresh details
     * without resetting outreach progress, unlike the manual "Add contact" form.
     */
    preserveStatus?: boolean;
  } = {},
): OutreachListData | undefined {
  if (!data) return data;

  const email = normalizeEmail(draft.email);
  const existingIndex = data.items.findIndex(
    (item) => normalizeEmail(item.email) === email,
  );

  if (existingIndex >= 0) {
    // The server refuses to resurrect an opted-out contact, so don't pretend.
    if (data.items[existingIndex].status === "UNSUBSCRIBED") return data;

    return {
      ...data,
      items: data.items.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              name: draft.name,
              email,
              institution: draft.institution || null,
              role: draft.role || null,
              source: draft.source || null,
              notes: draft.notes || null,
              ...(options.preserveStatus ? {} : { status: "PENDING" as const }),
            }
          : item,
      ),
    };
  }

  const optimistic: OutreachContactItem = {
    id: optimisticId,
    name: draft.name,
    email,
    institution: draft.institution || null,
    role: draft.role || null,
    source: draft.source || null,
    notes: draft.notes || null,
    status: "PENDING",
    sendCount: 0,
    outreachedAt: null,
    emailSentAt: null,
    createdAt: new Date(),
    createdByName: null,
    linkedUserId: null,
  };

  return { ...data, items: [optimistic, ...data.items], total: data.total + 1 };
}

/** Swap the temporary row id for the id the server persisted. */
export function confirmOptimisticOutreachContact(
  data: OutreachListData | undefined,
  optimisticId: string,
  persistedId: string,
): OutreachListData | undefined {
  if (!data) return data;

  return {
    ...data,
    items: data.items.map((item) =>
      item.id === optimisticId ? { ...item, id: persistedId } : item,
    ),
  };
}

/** Apply a partial update to one cached contact (edit / send state). */
export function patchOutreachContactInList(
  data: OutreachListData | undefined,
  id: string,
  patch: Partial<OutreachContactItem>,
): OutreachListData | undefined {
  if (!data) return data;

  return {
    ...data,
    items: data.items.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  };
}

/** Apply a patch (or per-row patch) to several cached contacts (bulk send). */
export function patchOutreachContactsInList(
  data: OutreachListData | undefined,
  ids: Iterable<string>,
  patch:
    | Partial<OutreachContactItem>
    | ((item: OutreachContactItem) => Partial<OutreachContactItem>),
): OutreachListData | undefined {
  if (!data) return data;

  const targets = new Set(ids);
  if (targets.size === 0) return data;

  return {
    ...data,
    items: data.items.map((item) =>
      targets.has(item.id)
        ? {
            ...item,
            ...(typeof patch === "function" ? patch(item) : patch),
          }
        : item,
    ),
  };
}

/** Drop a row that failed to persist (also used for the delete rollback). */
export function removeOutreachContactFromList(
  data: OutreachListData | undefined,
  id: string,
): OutreachListData | undefined {
  if (!data || !data.items.some((item) => item.id === id)) return data;

  return {
    ...data,
    items: data.items.filter((item) => item.id !== id),
    total: Math.max(0, data.total - 1),
  };
}
