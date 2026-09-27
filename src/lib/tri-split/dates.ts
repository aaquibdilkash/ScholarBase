/**
 * DMMF-derived `DateTime` column lists.
 *
 * `unstable_cache` persists via `JSON.stringify`, so every `Date` in a cached
 * row comes back as an ISO string and has to be revived on the way out. A
 * projection that uses `include` (all scalars) rather than an explicit `select`
 * has no hand-written list of which columns those are, and a list that is
 * missing one leaves a string in a field a card calls `.getTime()` on.
 *
 * Deriving the list from `Prisma.dmmf` means it cannot drift: a renamed or
 * retyped column changes it with the schema, and there is nothing to forget to
 * update.
 *
 * Results are memoised because the DMMF is static for the process lifetime and
 * a linear scan per model per call would be pure waste on a hot path.
 */
import { Prisma } from "@prisma/client";

const byModel = new Map<string, readonly string[]>();

/** Every `DateTime` column of a Prisma model, e.g. `socialPost`. */
export function dateKeysForModel(model: string): readonly string[] {
  const memoised = byModel.get(model);
  if (memoised) return memoised;

  const found =
    Prisma.dmmf.datamodel.models
      .find((m) => m.name === pascal(model))
      ?.fields.filter((f) => f.type === "DateTime")
      .map((f) => f.name) ?? [];

  byModel.set(model, found);
  return found;
}

/** PascalCase table name for a Prisma model key, e.g. `socialPost` -> `SocialPost`. */
export function pascal(model: string): string {
  return model.charAt(0).toUpperCase() + model.slice(1);
}
