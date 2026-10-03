/**
 * Where-clause evaluation.
 *
 * Supports the subset of Prisma's filter language that the pure-logic tier
 * actually exercises: scalar equality, `null`, the standard operator objects,
 * `AND`/`OR`/`NOT`, and Prisma's *composite unique key* shorthand
 * (`{ socialPostId_userId: { socialPostId, userId } }`).
 *
 * Anything it does not understand throws rather than silently matching nothing.
 * A fake that quietly returns an empty array would make a broken test pass,
 * which is worse than a fake that refuses to run.
 */
const OPERATORS = new Set([
  "equals",
  "in",
  "notIn",
  "lt",
  "lte",
  "gt",
  "gte",
  "contains",
  "startsWith",
  "endsWith",
  "not",
  "some",
])

export type Row = Record<string, unknown>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)
}

function equals(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a === undefined && b === null) return true
  if (a === null && b === undefined) return true
  return a === b
}

function applyOperator(op: string, value: unknown, condition: unknown): boolean {
  switch (op) {
    case "equals":
      return equals(value, condition)
    case "in":
      return Array.isArray(condition) && condition.some((entry) => equals(value, entry))
    case "notIn":
      return Array.isArray(condition) && !condition.some((entry) => equals(value, entry))
    // Scalar negation. `isHandleAvailable` uses `{ id: { not: <me> } }` so a user
    // keeping their own handle is not reported as taken; without this the fake
    // threw "unsupported nested filter" and the action could not be tested.
    case "not":
      return !equals(value, condition)
    // Relation existence: `{ notificationsReceived: { some: { isEmailed: false } } }`.
    // The digest's whole selection predicate depends on this, so without it the
    // P0-2 chunk worker could not be unit tested at all.
    case "some":
      return (
        Array.isArray(value) &&
        value.some((element) => matchWhere(element as Row, condition))
      )
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const left = value instanceof Date ? value.getTime() : (value as number)
      const right = condition instanceof Date ? condition.getTime() : (condition as number)
      if (left === null || left === undefined || Number.isNaN(left as number)) return false
      if (op === "lt") return (left as number) < (right as number)
      if (op === "lte") return (left as number) <= (right as number)
      if (op === "gt") return (left as number) > (right as number)
      return (left as number) >= (right as number)
    }
    case "contains":
      return typeof value === "string" && value.includes(String(condition))
    case "startsWith":
      return typeof value === "string" && value.startsWith(String(condition))
    case "endsWith":
      return typeof value === "string" && value.endsWith(String(condition))
    default:
      throw new Error(`fake-prisma: unsupported filter operator "${op}"`)
  }
}

/** Match a single field value against its filter condition. */
function matchesValue(value: unknown, condition: unknown): boolean {
  if (!isPlainObject(condition)) return equals(value, condition)

  const keys = Object.keys(condition)
  // `{}` is not a meaningful Prisma filter; treat it as equality only for
  // object-valued columns (JSON fields), which is what Prisma does.
  if (keys.length === 0) return equals(value, condition)

  if (!keys.every((key) => OPERATORS.has(key))) {
    // A to-one relation filter, e.g. `submitSurveyResponse`'s
    // `surveyAnswer.findMany({ where: { question: { archivedAt: null } } })`.
    //
    // The fake resolves relations by materialising them ON the row (see
    // `project`), so when the row already carries a plain object under this key
    // the filter can be evaluated against it directly. When it does not, the
    // relation was never materialised and guessing would be worse than failing.
    if (isPlainObject(value)) {
      return keys.every((key) => matchesValue(value[key], condition[key]))
    }
    throw new Error(
      `fake-prisma: unsupported nested filter ${JSON.stringify(condition)} — ` +
        "relation filters need the relation materialised on the row, or the " +
        "integration tier",
    )
  }

  return keys.every((key) => applyOperator(key, value, condition[key]))
}

export function matchWhere(row: Row, where: unknown): boolean {
  if (where === undefined || where === null) return true
  if (!isPlainObject(where)) {
    throw new Error(`fake-prisma: unsupported where clause ${JSON.stringify(where)}`)
  }

  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") {
      const list = Array.isArray(condition) ? condition : [condition]
      return list.every((clause) => matchWhere(row, clause))
    }
    if (key === "OR") {
      const list = Array.isArray(condition) ? condition : [condition]
      return list.some((clause) => matchWhere(row, clause))
    }
    if (key === "NOT") {
      const list = Array.isArray(condition) ? condition : [condition]
      return list.every((clause) => !matchWhere(row, clause))
    }

    // Composite unique shorthand: `socialPostId_userId` maps onto the
    // `socialPostId` + `userId` columns. Prisma derives these names by joining
    // field names with `_`, so we reverse that instead of carrying a schema.
    if (!(key in row) && key.includes("_") && isPlainObject(condition)) {
      const parts = key.split("_")
      if (!parts.every((part) => part in condition)) {
        throw new Error(
          `fake-prisma: composite where key "${key}" does not resolve onto its ` +
            `component fields (${JSON.stringify(condition)})`,
        )
      }
      return parts.every((part) => matchesValue(row[part], condition[part]))
    }

    return matchesValue(row[key], condition)
  })
}
