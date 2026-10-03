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
 * Nested relation writes (`create`/`connect`) are supported ONLY for relations a
 * test has explicitly declared via `store.link()` — see `RelationLink` in
 * `./store`. This was added for the survey response path
 * (`surveyResponse.create({ answers: { create: [...] } })`), which is what makes
 * `submitSurveyResponse` unit-testable at all. Deliberately still NOT
 * implemented (these throw loudly instead of guessing): `disconnect`,
 * `connectOrCreate`, nested `delete`, raw SQL, and cross-table constraint
 * enforcement. Those belong to the integration tier, against real Postgres.
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

/**
 * Applies a Prisma `select` to a row.
 *
 * Handles two shapes:
 *   - scalars (`{ id: true }`), and
 *   - a NESTED RELATION already materialised on the row
 *     (`{ notificationsReceived: { where, orderBy, take, select } }`).
 *
 * The nested case reads the array straight off the parent row, so a fixture must
 * embed its children (`userRow({ notificationsReceived: [...] })`). It is not a
 * relation resolver: nothing wires models together by foreign key. That is a
 * deliberate limit, but without it the digest worker's whole selection
 * predicate (`notificationsReceived: { some: { isEmailed: false } }`) could not
 * be unit tested at all.
 */
function project(row: Row, select: unknown): Row {
  if (!select) return clone(row)
  if (typeof select !== "object") throw new Error("fake-prisma: `select` must be an object")
  const out: Row = {}
  for (const [key, on] of Object.entries(select as Record<string, unknown>)) {
    if (on === true) {
      if (key in row) out[key] = clone(row[key])
      continue
    }
    if (!Array.isArray(row[key]) || typeof on !== "object" || on === null) continue

    const spec = on as {
      where?: unknown
      orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[]
      take?: number
      select?: unknown
    }

    let items = row[key] as Row[]
    if (spec.where) items = items.filter((element) => matchWhere(element, spec.where))

    const orders = spec.orderBy
      ? Array.isArray(spec.orderBy) ? spec.orderBy : [spec.orderBy]
      : []
    for (const order of orders.reverse()) {
      const [field, direction] = Object.entries(order)[0] ?? []
      if (!field) continue
      const factor = direction === "desc" ? -1 : 1
      items = [...items].sort((a, b) => {
        const left = a[field]
        const right = b[field]
        if (left === right) return 0
        if (left instanceof Date && right instanceof Date) {
          return (left.getTime() - right.getTime()) * factor
        }
        return ((left as never) > (right as never) ? 1 : -1) * factor
      })
    }

    if (typeof spec.take === "number") items = items.slice(0, spec.take)
    out[key] = spec.select ? items.map((element) => project(element, spec.select)) : clone(items)
  }
  return out
}

/**
 * Every nested relation-write verb Prisma accepts. Used ONLY to RECOGNISE that
 * something is a relation write; the fake then permits just `NESTED_SUPPORTED`
 * and refuses the rest loudly.
 *
 * Recognition must be by verb name rather than "any non-numeric object",
 * because survey answers are JSONB: a matrix answer is a plain object like
 * `{ row_c: 3 }` that has to be stored verbatim. Treating that as a relation
 * write would throw on legitimate data.
 */
const NESTED_VERBS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "connect",
  "connectOrCreate",
  "disconnect",
  "delete",
  "deleteMany",
  "set",
  "upsert",
  "update",
  "updateMany",
  "updateManyAndReturn",
])

/**
 * Nested write verbs that mean "materialise a row on another table".
 *
 * `NESTED_SUPPORTED` is a WHITELIST on purpose. A blacklist has to enumerate
 * every verb Prisma might add and silently stores anything it misses — which is
 * how a broken write becomes a passing test. Anything outside this list throws.
 */
const NESTED_SUPPORTED = new Set(["create", "connect"])

/**
 * Apply Prisma's atomic update operators onto a mutable row.
 *
 * `model`/`store` are needed because a nested `create` writes to a DIFFERENT
 * table than the row being updated, and the child must be attached back to the
 * parent's materialised relation array so a later `include` can read it.
 */
function applyData(
  row: Row,
  data: Record<string, unknown>,
  model: string,
  store: FakeStore,
): void {
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

      // Recognise a relation write by its verb name, then permit only the
      // whitelisted verbs. A JSONB object that is not a relation write falls
      // through and is stored verbatim.
      const nestedVerb = Object.keys(ops).find((verb) => NESTED_VERBS.has(verb))
      if (nestedVerb) {
        if (!NESTED_SUPPORTED.has(nestedVerb)) {
          throw new Error(
            `fake-prisma: nested relation write \`${key}.${nestedVerb}\` is not ` +
              "supported — declare the relation with `link()` and use `create`/`connect`, " +
              "or use the integration tier",
          )
        }
        const link = store.findLink(model, key)
        if (!link) throw undeclaredRelation(model, key, nestedVerb)

        if (nestedVerb === "connect") {
          // A bare `connect` on a to-one relation is a foreign key assignment:
          // `question: { connect: { id } }` means "this answer belongs to question X".
          row[link.fk] = clone((ops.connect as Record<string, unknown>).id)
          continue
        }

        const specs = Array.isArray(ops.create) ? ops.create : [ops.create]
        // Attach the new children so a later `include: { answers: true }` sees them.
        row[key] = specs.map((spec) =>
          store.createChild(link, row.id, spec as Record<string, unknown>),
        )
        continue
      }
    }
    row[key] = clone(raw)
  }
}

function undeclaredRelation(model: string, relation: string, verb: string): Error {
  return new Error(
    `fake-prisma: \`${model}.${relation}.${verb}\` has no declared relation. ` +
      "The fake will not guess Prisma's naming conventions — a wrong guess would " +
      "make a broken action look correct. Declare it first, e.g. " +
      `fakeDb.link({ parent: "${model}", relation: "${relation}", ` +
      'child: "<childModel>", fk: "<fkColumn>" }).',
  )
}

export type Args = {
where?: unknown
  data?: Record<string, unknown>
  /**
   * Prisma projection. The fake implements `select` faithfully and treats
   * `include` as "return the row whole", because its relation arrays are
   * already materialised on the row (see `project`).
   */
  select?: unknown
  include?: unknown
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

  private record(op: string, args: Args | { data: Array<Record<string, unknown>> }): void {
    this.store.calls.push({ model: this.model, op, args: args as Args })
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

  /**
   * Added for `institution.ts`, which calls `findUniqueOrThrow` on a row it has
   * already confirmed exists. Prisma throws `P2025` when nothing matches; the
   * message mirrors the existing `mustFind` helper so the fake's failure modes
   * stay uniform.
   */
  async findUniqueOrThrow(args: Args = {}): Promise<Row> {
    this.record("findUniqueOrThrow", args)
    const row = this.findRow(args.where)
    if (!row) {
      throw new Error(
        "fake-prisma: An operation failed because it requires a record that does " +
          `not exist. (no ${this.model}.findUniqueOrThrow matched ${JSON.stringify(args.where)})`,
      )
    }
    return project(row, args.select)
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
    const row: Row = { createdAt: new Date(), updatedAt: new Date(), id: data.id }
    // `applyData` (not a raw spread) so nested `answers: { create: [...] }`
    // materialises child rows instead of being stored verbatim as a literal
    // `{ create: [...] }` object — which is what a bare spread did, silently
    // producing a response whose `answers` were not answers at all.
    applyData(row, data, this.model, this.store)
    this.store.put(this.model, row)
    return project(row, args.select)
  }

  /**
   * Batch insert. `createSurvey` writes its questions and options this way, and
   * options genuinely cannot be nested in the same call, which is why the fake
   * mirrors the two-step shape rather than flattening it.
   */
  async createMany(args: { data: Array<Record<string, unknown>> }): Promise<{ count: number }> {
    this.record("createMany", args)
    const specs = args.data
    if (!Array.isArray(specs)) {
      throw new Error("fake-prisma: `createMany` requires `data` to be an array")
    }
    for (const spec of specs) {
      await this.create({ data: spec })
    }
    return { count: specs.length }
  }

  async upsert(args: Args = {}): Promise<Row> {
    this.record("upsert", args)
    const existing = this.findRow(args.where)
    if (existing) {
      applyData(existing, args.update ?? {}, this.model, this.store)
      existing.updatedAt = new Date()
      return project(existing, args.select)
    }
    return this.create({ data: args.create ?? {}, select: args.select })
  }

  async update(args: Args = {}): Promise<Row> {
    this.record("update", args)
    const row = this.mustFind(args.where, "update")
    applyData(row, args.data ?? {}, this.model, this.store)
    row.updatedAt = new Date()
    return project(row, args.select)
  }

  async updateMany(args: Args = {}): Promise<{ count: number }> {
    this.record("updateMany", args)
    const matches = this.rows.filter((candidate) => matchWhere(candidate, args.where))
    for (const row of matches) {
      applyData(row, args.data ?? {}, this.model, this.store)
      row.updatedAt = new Date()
    }
    return { count: matches.length }
  }

  async delete(args: Args = {}): Promise<Row> {
    this.record("delete", args)
    const row = this.mustFind(args.where, "delete")
    this.store.remove(this.model, row)
    this.store.detachChildren(this.model, [row])
    return project(row, args.select)
  }

  async deleteMany(args: Args = {}): Promise<{ count: number }> {
    this.record("deleteMany", args)
    const matches = this.rows.filter((candidate) => matchWhere(candidate, args.where))
    for (const row of matches) this.store.remove(this.model, row)
    this.store.detachChildren(this.model, matches)
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
