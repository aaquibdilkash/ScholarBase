import { describe, expect, it } from "vitest";

import type { OutreachContactItem } from "@/app/actions/outreach";
import {
  addOutreachContactOptimistically,
  confirmOptimisticOutreachContact,
  createOptimisticOutreachId,
  isOptimisticOutreachId,
  OUTREACH_QUERY_KEY,
  outreachQueryKey,
  patchOutreachContactInList,
  patchOutreachContactsInList,
  removeOutreachContactFromList,
  type OutreachListData,
} from "@/utils/outreach-cache";

function contact(
  overrides: Partial<OutreachContactItem> = {},
): OutreachContactItem {
  return {
    id: "c-1",
    name: "Jane Scholar",
    email: "jane@university.edu",
    institution: null,
    role: null,
    source: null,
    notes: null,
    status: "PENDING",
    sendCount: 0,
    outreachedAt: null,
    emailSentAt: null,
    createdAt: new Date("2026-01-01"),
    createdByName: null,
    linkedUserId: null,
    ...overrides,
  };
}

function list(items: OutreachContactItem[]): OutreachListData {
  return { items, total: items.length };
}

describe("addOutreachContactOptimistically", () => {
  it("prepends a new contact and increments the total", () => {
    const existing = contact();
    const next = addOutreachContactOptimistically(
      list([existing]),
      { name: "Ada Lovelace", email: "Ada@University.edu" },
      "optimistic-1",
    );

    expect(next?.items).toHaveLength(2);
    expect(next?.total).toBe(2);
    expect(next?.items[0]).toMatchObject({
      id: "optimistic-1",
      name: "Ada Lovelace",
      email: "ada@university.edu",
      status: "PENDING",
      sendCount: 0,
    });
  });

  it("refreshes an existing email instead of duplicating it", () => {
    const next = addOutreachContactOptimistically(
      list([contact({ id: "c-1", status: "OUTREACHED", sendCount: 2 })]),
      {
        name: "Jane Updated",
        email: " JANE@university.edu ",
        institution: "Test University",
        role: "Professor",
      },
      "optimistic-1",
    );

    expect(next?.items).toHaveLength(1);
    expect(next?.total).toBe(1);
    expect(next?.items[0]).toMatchObject({
      id: "c-1",
      name: "Jane Updated",
      email: "jane@university.edu",
      institution: "Test University",
      role: "Professor",
      status: "PENDING",
      sendCount: 2,
    });
  });

  it("leaves an opted-out contact untouched", () => {
    const unsubscribed = contact({ status: "UNSUBSCRIBED" });
    const next = addOutreachContactOptimistically(
      list([unsubscribed]),
      { name: "Jane Again", email: "jane@university.edu" },
      "optimistic-1",
    );

    expect(next?.items).toEqual([unsubscribed]);
    expect(next?.total).toBe(1);
  });

  it("returns the cache untouched when it has not loaded", () => {
    expect(
      addOutreachContactOptimistically(
        undefined,
        { name: "Jane", email: "jane@university.edu" },
        "optimistic-1",
      ),
    ).toBeUndefined();
  });
});

describe("confirmOptimisticOutreachContact", () => {
  it("swaps the temporary id for the persisted id", () => {
    const next = confirmOptimisticOutreachContact(
      list([contact({ id: "optimistic-1" })]),
      "optimistic-1",
      "c-real",
    );

    expect(next?.items[0].id).toBe("c-real");
    expect(next?.total).toBe(1);
  });
});

describe("patchOutreachContactInList", () => {
  it("merges the patch into the matching row only", () => {
    const next = patchOutreachContactInList(
      list([contact({ id: "c-1" }), contact({ id: "c-2" })]),
      "c-2",
      { name: "Bob", status: "OUTREACHED", sendCount: 1 },
    );

    expect(next?.items[0].name).toBe("Jane Scholar");
    expect(next?.items[1]).toMatchObject({
      id: "c-2",
      name: "Bob",
      status: "OUTREACHED",
      sendCount: 1,
    });
  });
});

describe("patchOutreachContactsInList", () => {
  it("patches every selected row and leaves the rest alone", () => {
    const next = patchOutreachContactsInList(
      list([
        contact({ id: "c-1", sendCount: 1 }),
        contact({ id: "c-2", sendCount: 2 }),
        contact({ id: "c-3", sendCount: 3 }),
      ]),
      ["c-1", "c-3"],
      (item) => ({ status: "OUTREACHED", sendCount: item.sendCount + 1 }),
    );

    expect(next?.items.map((item) => item.sendCount)).toEqual([2, 2, 4]);
    expect(next?.items.map((item) => item.status)).toEqual([
      "OUTREACHED",
      "PENDING",
      "OUTREACHED",
    ]);
  });

  it("returns the same cache when nothing is selected", () => {
    const data = list([contact()]);

    expect(patchOutreachContactsInList(data, [], { status: "OUTREACHED" })).toBe(
      data,
    );
  });
});

describe("removeOutreachContactFromList", () => {
  it("drops the row and decrements the total", () => {
    const next = removeOutreachContactFromList(
      list([contact({ id: "optimistic-1" }), contact({ id: "c-2" })]),
      "optimistic-1",
    );

    expect(next?.items.map((item) => item.id)).toEqual(["c-2"]);
    expect(next?.total).toBe(1);
  });

  it("does not decrement the total for an unknown id", () => {
    const data = list([contact()]);

    expect(removeOutreachContactFromList(data, "missing")).toBe(data);
  });
});

describe("optimistic ids", () => {
  it("are unique and recognised as temporary", () => {
    const first = createOptimisticOutreachId();
    const second = createOptimisticOutreachId();

    expect(first).not.toBe(second);
    expect(isOptimisticOutreachId(first)).toBe(true);
    expect(isOptimisticOutreachId("c-1")).toBe(false);
  });
});

describe("outreachQueryKey", () => {
  it("keeps the shared prefix so one invalidation purges every page", () => {
    const key = outreachQueryKey(3);

    expect(key.slice(0, OUTREACH_QUERY_KEY.length)).toEqual([
      ...OUTREACH_QUERY_KEY,
    ]);
    expect(key.at(-1)).toBe(3);
  });

  it("separates page entries", () => {
    expect(outreachQueryKey(1)).not.toEqual(outreachQueryKey(2));
  });
});
