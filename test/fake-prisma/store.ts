import { FakeDelegate, type Args, type RecordedCall } from "./delegate"
import type { Row } from "./match"

/**
 * A relation the fake knows how to wire.
 *
 * The fake does NOT resolve relations by convention (`answers` -> `surveyAnswer`,
 * `question` -> `questionId`): guessing Prisma's naming is exactly the kind of
 * silent wrongness this harness exists to prevent, and a wrong guess would make a
 * broken action pass. Instead a test declares the wiring it needs, once, and any
 * nested write without a declaration fails loudly.
 */
export interface RelationLink {
  /** Model holding the foreign key's parent row, e.g. `surveyResponse`. */
  parent: string
  /** Relation name used in the nested write, e.g. `answers`. */
  relation: string
  /** Model that receives the child row, e.g. `surveyAnswer`. */
  child: string
  /** Foreign key column on the child that points at the parent, e.g. `responseId`. */
  fk: string
}

/**
 * The in-memory tables plus the `prisma`-shaped facade the code under test
 * imports. `createFakePrisma()` returns everything a test needs: the client to
 * inject, plus seeding and inspection helpers.
 */
export class FakeStore {
  readonly calls: RecordedCall[] = []
  private tables = new Map<string, Row[]>()
  private relations: RelationLink[] = []

  /**
   * Declare a relation so nested `create`/`connect` writes materialise real rows.
   *
   * Declaring the same link twice is a no-op rather than an error: `beforeEach`
   * re-seeding plus a module-level declaration is a natural shape, and rejecting
   * it would push tests toward defensive bookkeeping for no analytical gain.
   */
  link(link: RelationLink): void {
    const exists = this.relations.some(
      (candidate) =>
        candidate.parent === link.parent &&
        candidate.relation === link.relation &&
        candidate.child === link.child &&
        candidate.fk === link.fk,
    )
    if (!exists) this.relations.push({ ...link })
  }

  findLink(parent: string, relation: string): RelationLink | undefined {
    return this.relations.find(
      (candidate) => candidate.parent === parent && candidate.relation === relation,
    )
  }

  linksForChild(child: string): RelationLink[] {
    return this.relations.filter((candidate) => candidate.child === child)
  }

  /**
   * Relations deliberately SURVIVE `reset()`.
   *
   * Tests declare their wiring once at module scope; wiping it in `beforeEach`
   * would silently break every test after the first. Cross-file leakage is not
   * possible anyway — Vitest gives each test file its own module graph, so
   * `instance.ts` hands every file a private `FakeStore`.
   */
  reset(): void {
    this.tables = new Map()
    this.calls.length = 0
  }

  /**
   * Materialise one child row for a nested `create`, resolving any nested
   * `connect` in the child's own data into the child's foreign key.
   *
   * This is what makes `surveyResponse.create({ answers: { create: [...] } })`
   * produce real `surveyAnswer` rows instead of throwing.
   */
  createChild(link: RelationLink, parentId: unknown, spec: Record<string, unknown>): Row {
    const data: Record<string, unknown> = { ...spec }
    data[link.fk] = parentId
    data.id ??= `child_${link.child}_${(childIdCounter += 1)}`

    for (const [key, raw] of Object.entries(spec)) {
      const nestedLink = this.findLink(link.child, key)
      const connectId = connectedId(raw)
      if (!nestedLink || connectId === undefined) continue
      data[nestedLink.fk] = connectId
      delete data[key]
    }

    const row: Row = { createdAt: new Date(), updatedAt: new Date(), ...data }
    this.put(link.child, row)
    return row
  }

  /**
   * Drop removed child rows from their parents' materialised relation arrays.
   *
   * Without this a parent's `answers` array would keep answering questions the
   * database has already deleted, and `submitSurveyResponse`'s upsert path would
   * look like it re-submitted an archived question's answer.
   */
  detachChildren(child: string, removed: Row[]): void {
    if (removed.length === 0) return
    for (const link of this.linksForChild(child)) {
      const removedIds = new Set(removed.map((row) => String(row.id)))
      for (const parent of this.rowsFor(link.parent)) {
        const children = parent[link.relation]
        if (!Array.isArray(children)) continue
        parent[link.relation] = (children as Row[]).filter(
          (childRow) => !removedIds.has(String(childRow.id)),
        )
      }
    }
  }

  rowsFor(model: string): Row[] {
    let table = this.tables.get(model)
    if (!table) {
      table = []
      this.tables.set(model, table)
    }
    return table
  }

  put(model: string, row: Row): void {
    this.rowsFor(model).push(row)
  }

  remove(model: string, row: Row): void {
    const table = this.rowsFor(model)
    const index = table.indexOf(row)
    if (index >= 0) table.splice(index, 1)
  }

  /** Insert rows verbatim (ids included) — the seeding entry point. */
  seed(model: string, rows: Row | Row[]): Row[] {
    const list = Array.isArray(rows) ? rows : [rows]
    for (const row of list) {
      if (row.id === undefined) throw new Error(`fake-prisma: seeded ${model} row needs an id`)
      this.put(model, structuredClone(row))
    }
    return this.rowsFor(model).filter((row) => list.some((seeded) => seeded.id === row.id))
  }

  /** Read a table back for assertions (returns live rows; clone if mutating). */
  table(model: string): Row[] {
    return this.rowsFor(model)
  }

  snapshot(): Map<string, Row[]> {
    const copy = new Map<string, Row[]>()
    for (const [model, rows] of this.tables) copy.set(model, structuredClone(rows))
    return copy
  }

  restore(snapshot: Map<string, Row[]>): void {
    this.tables = new Map()
    for (const [model, rows] of snapshot) this.tables.set(model, structuredClone(rows))
  }
}

/**
 * Child-row id counter, deliberately NOT shared with `FakeDelegate.nextId`.
 *
 * Both mint `<something>_<model>_<n>`, so sharing a counter would let a nested
 * child collide with a directly-created row of the same model. The `child_`
 * prefix keeps the two id spaces disjoint; tests assert ids exist and are
 * distinct, never on their literal text.
 */
let childIdCounter = 0

/** Extract `{ connect: { id } }` -> `id`. Returns undefined for anything else. */
function connectedId(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") return undefined
  const connect = (raw as Record<string, unknown>).connect
  if (connect === null || typeof connect !== "object") return undefined
  const id = (connect as Record<string, unknown>).id
  return id === undefined || id === null ? undefined : id
}

const RAW_SQL_MESSAGE =
  "fake-prisma: raw SQL was called from a unit test. The 19 raw-SQL sites " +
  "(pg_class row counts, to_tsvector search, pg_trgm similarity, cron " +
  "$executeRawUnsafe) cannot be faked faithfully — they need the integration " +
  "tier against a real Postgres."

/**
 * The injected client: one delegate per model, plus the `$`-helpers the fake
 * implements. Modelled rather than `any` so a test keeps argument checking on
 * the model it reaches for, and a mistyped delegate name fails at `tsc` instead
 * of at runtime.
 */
export type FakePrismaClient = Record<string, FakeDelegate> & {
  /** Runs the callback against a snapshot that is restored on a throw. */
  $transaction: <T>(
    input: ((tx: FakePrismaClient) => Promise<T>) | unknown[],
    options?: unknown,
  ) => Promise<T>
  /** Raw SQL is not faked; the unit tier fails loudly instead. */
  $queryRawUnsafe: (...args: unknown[]) => Promise<never>
}

export interface FakePrisma {
  /** The object to inject in place of the real `@/lib/db` default export. */
  client: FakePrismaClient
  store: FakeStore
  seed(model: string, rows: Row | Row[]): Row[]
  rows(model: string): Row[]
  /**
   * Declare a relation so nested `create`/`connect` writes materialise real rows.
   *
   * Without a declaration a nested write still throws — the fake will not guess
   * Prisma's naming conventions, because a wrong guess makes a broken action
   * look correct.
   */
  link(relation: RelationLink): void
  calls(): RecordedCall[]
  reset(): void
}

export function createFakePrisma(): FakePrisma {
  const store = new FakeStore()
  const delegates = new Map<string, FakeDelegate>()

  const delegateFor = (model: string): FakeDelegate => {
    let delegate = delegates.get(model)
    if (!delegate) {
      delegate = new FakeDelegate(store, model)
      delegates.set(model, delegate)
    }
    return delegate
  }

  // Snapshot/restore gives the fake real transactional rollback, which matters:
  // several RULE 3 guarantees are "a failed write must not move counters", and
  // a fake that left partial writes behind would pass a broken implementation.
  const $transaction = async (input: unknown, _options?: unknown) => {
    const snapshot = store.snapshot()
    const tx = new Proxy({} as Record<string, unknown>, {
      get(_target, prop) {
        if (typeof prop === "symbol") return undefined
        if (prop === "$transaction") return $transaction
        if (prop.startsWith("$")) return () => Promise.reject(new Error(RAW_SQL_MESSAGE))
        return delegateFor(String(prop))
      },
    })

    if (typeof input === "function") {
      try {
        return await (input as (client: unknown) => unknown)(tx)
      } catch (error) {
        store.restore(snapshot)
        throw error
      }
    }

    if (Array.isArray(input)) {
      try {
        return await Promise.all(input)
      } catch (error) {
        store.restore(snapshot)
        throw error
      }
    }

    throw new Error("fake-prisma: $transaction expects a callback or an array of operations")
  }

  const client = new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
      if (typeof prop === "symbol" || prop === "then" || prop === "$$typeof") return undefined
      if (prop === "$transaction") return $transaction
      if (prop === "$connect" || prop === "$disconnect" || prop === "$on" || prop === "$use") {
        return () => Promise.resolve()
      }
      if (typeof prop === "string" && prop.startsWith("$")) {
        return () => Promise.reject(new Error(RAW_SQL_MESSAGE))
      }
      return delegateFor(String(prop))
    },
  }) as unknown as FakePrismaClient

  return {
    client,
    store,
    seed: (model, rows) => store.seed(model, rows),
    rows: (model) => store.table(model),
    link: (relation) => store.link(relation),
    calls: () => [...store.calls],
    reset: () => store.reset(),
  }
}

export type { Args, RecordedCall, Row }
