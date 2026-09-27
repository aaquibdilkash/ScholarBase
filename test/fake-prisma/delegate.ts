import { matchWhere, type Row } from "./match"
import type { FakeStore } from "./store"

/**
 * In-memory Prisma stand-in.
 *
 * `handleVoteTransaction` and friends call `prisma.$transaction(async (tx) => …)`
 * against the module-level client rather than accepting one, so the only way to
 * unit-test the RULE 3 voting matrix is to intercept that call and hand the
 * callback a fake `tx`. This module provides exactly that.
 *
 * Deliberately NOT implemented (these throw loudly instead of guessing):
 * relation writes (`connect`/nested `create`), raw SQL, session isolation.
 * Those belong to the integration tier, against real Postgres.
 */

const NUMERIC_OPS = new Set(["increment", "decrement", "multiply", "divide", "set"])

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `fake_${prefix}_${idCounter}`
}

function clone<T>(value: T): T {
  return value === undefined ? value : (structuredClone(value) as T)
}

function project(row: Row, select: unknown): Row {
  if (!select) return clone(row)
  if (typeof select !== "object") throw new Error("fake-prisma: `select` must be an object")
  const out: Row = {}
  for (const [key, on] of Object.entries(select as Record<string, unknown>)) {
    if (on === true && key in row) out[key] = clone(row[key])
  }
  return out
}

/** Apply Prisma's atomic update operators onto a mutable row. */
function applyData(row: Row, data: Record<string, unknown>): void {
  for (const [key, raw] of Object.entries(data)) {
    if (raw !== null && typeof raw === "object" && !(raw instanceof Date) && !Array.isArray(raw)) {
      const ops = raw as Record<string, unknown>
      const keys = Object.keys(ops)
      if (keys.length > 0 && keys.every((op) => NUMERIC_OPS.has(op))) {
        for (const [op, operand] of Object.entries(ops)) {
          const current = (row[key] as number) ?? 0
          const value = operand as number
          if (op === "increment") row[key] = current + value
          else if (op === "decrement") row[key] = current - value
          else if (op === "multiply") row[key] = current * value
          else if (op === "divide") row[key] = current / value
          else row[key] = clone(value)
        }
        continue
      }
      for (const nested of ["connect", "disconnect", "create", "connectOrCreate", "delete"]) {
        if (nested in ops) {
          throw new Error(
            `fake-prisma: nested relation writes (\`${key}.${nested}\`) are not ` +
              "supported — use the integration tier",
          )
        }
      }
    }
    row[key] = clone(raw)
  }
}

export type Args = {
  where?: unknown
  data?: Record<string, unknown>
  select?: unknown
  create?: Record<string, unknown>
  update?: Record<string, unknown>
  orderBy?: unknown
  skip?: number
  take?: number
}

export type RecordedCall = { model: string; op: string; args: Args }

function equalsId(a: unknown, b: unknown): boolean {
  return a === b || String(a) === String(b)
}

export class FakeDelegate {
  constructor(
    private readonly store: FakeStore,
    readonly model: string,
  ) {}

  private get rows(): Row[] {
    return this.store.rowsFor(this.model)
  }

  private record(op: string, args: Args): void {
    this.store.calls.push({ model: this.model, op, args })
  }

  private findRow(where: unknown): Row | undefined {
    if (where === undefined || where === null) {
      throw new Error(`fake-prisma: ${this.model} write requires a \`where\` clause`)
    }
    return this.rows.find((row) => matchWhere(row, where))
  }

  /** Mirrors Prisma's P2025 so code that asserts on a missing row behaves alike. */
  private mustFind(where: unknown, op: string): Row {
    const row = this.findRow(where)
    if (!row) {
      throw new Error(
        "fake-prisma: An operation failed because it requires a record that does " +
          `not exist. (no ${this.model}.${op} matched ${JSON.stringify(where)})`,
      )
    }
    return row
  }

  async findUnique(args: Args = {}): Promise<Row | null> {
    this.record("findUnique", args)
    const row = this.findRow(args.where)
    return row ? project(row, args.select) : null
  }

  async findFirst(args: Args = {}): Promise<Row | null> {
    this.record("findFirst", args)
    const row = this.sorted(args).find((candidate) => matchWhere(candidate, args.where))
    return row ? project(row, args.select) : null
  }

  async findMany(args: Args = {}): Promise<Row[]> {
    this.record("findMany", args)
    let rows = this.sorted(args).filter((candidate) => matchWhere(candidate, args.where))
    if (args.skip !== undefined) rows = rows.slice(args.skip)
    if (args.take !== undefined) rows = rows.slice(0, args.take)
    return rows.map((row) => project(row, args.select))
  }

  async count(args: Args = {}): Promise<number> {
    this.record("count", args)
    return this.rows.filter((candidate) => matchWhere(candidate, args.where)).length
  }

  async create(args: Args = {}): Promise<Row> {
    this.record("create", args)
    const data = { ...(args.data ?? {}) }
    if (data.id === undefined) data.id = nextId(this.model)
    if (this.rows.some((row) => equalsId(row.id, data.id))) {
      throw new Error(`fake-prisma: unique constraint violation on ${this.model}.id`)
    }
    const row: Row = { createdAt: new Date(), updatedAt: new Date(), ...data }
    this.store.put(this.model, row)
    return project(row, args.select)
  }

  async upsert(args: Args = {}): Promise<Row> {
    this.record("upsert", args)
    const existing = this.findRow(args.where)
    if (existing) {
      applyData(existing, args.update ?? {})
      existing.updatedAt = new Date()
      return project(existing, args.select)
    }
    return this.create({ data: args.create ?? {}, select: args.select })
  }

  async update(args: Args = {}): Promise<Row> {
    this.record("update", args)
    const row = this.mustFind(args.where, "update")
    applyData(row, args.data ?? {})
    row.updatedAt = new Date()
    return project(row, args.select)
  }

  async updateMany(args: Args = {}): Promise<{ count: number }> {
    this.record("updateMany", args)
    const matches = this.rows.filter((candidate) => matchWhere(candidate, args.where))
    for (const row of matches) {
      applyData(row, args.data ?? {})
      row.updatedAt = new Date()
    }
    return { count: matches.length }
  }

  async delete(args: Args = {}): Promise<Row> {
    this.record("delete", args)
    const row = this.mustFind(args.where, "delete")
    this.store.remove(this.model, row)
    return project(row, args.select)
  }

  async deleteMany(args: Args = {}): Promise<{ count: number }> {
    this.record("deleteMany", args)
    const matches = this.rows.filter((candidate) => matchWhere(candidate, args.where))
    for (const row of matches) this.store.remove(this.model, row)
    return { count: matches.length }
  }

  private sorted(args: Args): Row[] {
    const rows = [...this.rows]
    if (!args.orderBy) return rows
    const clauses = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]
    return rows.sort((left, right) => {
      for (const clause of clauses) {
        if (typeof clause !== "object" || clause === null) continue
        for (const [field, direction] of Object.entries(clause as Record<string, unknown>)) {
          const multiplier = direction === "desc" ? -1 : 1
          const a = left[field]
          const b = right[field]
          if (a === b) continue
          if (a === null || a === undefined) return 1
          if (b === null || b === undefined) return -1
          return (a > b ? 1 : -1) * multiplier
        }
      }
      return 0
    })
  }
}
