import { createFakePrisma, type FakePrisma } from "./store"

/**
 * A single fake shared between the `vi.mock("@/lib/db")` factory and the test
 * file.
 *
 * `vi.mock` factories are hoisted above the imports of the file they live in, so
 * the factory cannot close over a local. Both sides import this module instead,
 * and because only `@/lib/db` is mocked (not this path) they receive the very
 * same instance. Tests call `resetFakeDb()` in `beforeEach`.
 */
export const fakeDb: FakePrisma = createFakePrisma()

export function resetFakeDb(): void {
  fakeDb.reset()
}
