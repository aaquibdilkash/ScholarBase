import { FakeDelegate, type Args, type RecordedCall } from "./delegate"
import type { Row } from "./match"

/**
 * The in-memory tables plus the `prisma`-shaped facade the code under test
 * imports. `createFakePrisma()` returns everything a test needs: the client to
 * inject, plus seeding and inspection helpers.
 */
export class FakeStore {
  readonly calls: RecordedCall[] = []
  private tables = new Map<string, Row[]>()

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

  reset(): void {
    this.tables = new Map()
    this.calls.length = 0
  }
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
    calls: () => [...store.calls],
    reset: () => store.reset(),
  }
}

export type { Args, RecordedCall, Row }
