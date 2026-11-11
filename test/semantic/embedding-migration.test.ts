import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EMBEDDING_TABLES,
  EMBEDDING_TRIGGER_FIELDS,
  type EmbeddingEntityType,
} from "@/lib/semantic/text";

/**
 * Locks the vector migration to the entity registry and the text projections.
 *
 * The trigger is the only thing that enqueues edits; if a builder starts
 * reading a new column but the trigger does not watch it, edits to that column
 * silently leave a stale vector behind. The CASE branch and the enum are
 * checked too, so a renamed type fails here instead of at runtime.
 */
const MIGRATION = (
  readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261111150000_rename_phd_admissions_to_admissions/migration.sql",
    ),
    "utf8",
  ) +
  readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261111160000_rename_job_vacancies_to_academic_positions/migration.sql",
    ),
    "utf8",
  ) +
  readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261110180000_rename_research_events_to_call_for_papers/migration.sql",
    ),
    "utf8",
  ) +
  readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261101000000_semantic_embeddings/migration.sql",
    ),
    "utf8",
  )
)
  // The original migrations are intentionally immutable; the forward migrations
  // rename these entities and the assertions validate the resulting vocabulary.
  .replaceAll("ResearchEvent", "CallForPaper")
  .replaceAll("RESEARCH_EVENT", "CALL_FOR_PAPER")
  .replaceAll("PhdAdmission", "Admission")
  .replaceAll("PHD_ADMISSION", "ADMISSION")
  .replaceAll("JobVacancy", "AcademicPosition")
  .replaceAll("JOB_VACANCY", "ACADEMIC_POSITION");

const ENTITY_ENTRIES = Object.entries(EMBEDDING_TABLES) as Array<
  [EmbeddingEntityType, string]
>;

function triggerColumns(triggerName: string): string[] {
  const match = MIGRATION.match(
    new RegExp(
      `CREATE TRIGGER "${triggerName}"\\s+BEFORE INSERT OR UPDATE OF\\s+([\\s\\S]*?)\\s+ON "public"\\."`,
    ),
  );

  if (!match) {
    throw new Error(`Trigger ${triggerName} not found in embedding migration.`);
  }

  return [...match[1].matchAll(/"([^"]+)"/g)]
    .map((column) => column[1])
    .filter((column) => column !== "isDeleted");
}

describe("semantic embedding migration", () => {
  it("installs pgvector", () => {
    expect(MIGRATION).toMatch(
      /CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;/,
    );
  });

  it("declares every entity type in the database enum", () => {
    const enumBlock = MIGRATION.match(
      /CREATE TYPE "public"\."EmbeddingEntityType" AS ENUM \(([\s\S]*?)\);/,
    );

    expect(enumBlock).not.toBeNull();

    const values = [...(enumBlock?.[1] ?? "").matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(values.sort()).toEqual(
      ENTITY_ENTRIES.map(([entityType]) => entityType).sort(),
    );
  });

  it("adds a nullable 384-dimensional column to every content table", () => {
    for (const [entityType, table] of ENTITY_ENTRIES) {
      expect(MIGRATION, entityType).toMatch(
        new RegExp(
          `ALTER TABLE "public"\\."${table}"\\s+ADD COLUMN IF NOT EXISTS "embedding" vector\\(384\\);`,
        ),
      );
    }
  });

  it("creates a partial HNSW cosine index for every content table", () => {
    for (const [entityType, table] of ENTITY_ENTRIES) {
      expect(MIGRATION, entityType).toMatch(
        new RegExp(
          `CREATE INDEX IF NOT EXISTS "${table}_embedding_hnsw_idx"\\s+` +
            `ON "public"\\."${table}" USING hnsw \\("embedding" vector_cosine_ops\\)[\\s\\S]*?` +
            `WHERE "embedding" IS NOT NULL;`,
        ),
      );
    }
  });

  it("maps every table to its entity type in the enqueue function", () => {
    for (const [entityType, table] of ENTITY_ENTRIES) {
      expect(MIGRATION, entityType).toContain(`WHEN '${table}' THEN`);
      expect(MIGRATION, entityType).toMatch(
        new RegExp(
          `WHEN '${table}' THEN\\s+v_entity_type := '${entityType}';`,
        ),
      );
    }
  });

  it("creates the outbox with coalescing and claim-order indexes", () => {
    expect(MIGRATION).toMatch(
      /CREATE TABLE IF NOT EXISTS "public"\."EmbeddingJob"/,
    );
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "EmbeddingJob_entityType_entityId_key"\s+ON "public"\."EmbeddingJob" \("entityType", "entityId"\);/,
    );
    expect(MIGRATION).toMatch(
      /CREATE INDEX IF NOT EXISTS "EmbeddingJob_runAt_createdAt_idx"\s+ON "public"\."EmbeddingJob" \("runAt", "createdAt"\);/,
    );
    expect(MIGRATION).toMatch(/"version" = job\."version" \+ 1/);
  });

  it("clears the vector and queued job on soft delete", () => {
    expect(MIGRATION).toMatch(/IF NEW\."isDeleted" THEN/);
    expect(MIGRATION).toMatch(/NEW\."embedding" := NULL;/);
  });

  it("watches exactly the columns read by each text builder", () => {
    for (const [entityType, table] of ENTITY_ENTRIES) {
      expect(triggerColumns(`${table}_embedding_enqueue_trg`), entityType).toEqual(
        [...EMBEDDING_TRIGGER_FIELDS[entityType]],
      );
    }
  });

  it("creates exactly one trigger per entity table", () => {
    const triggers = [...MIGRATION.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect([...new Set(triggers)].sort()).toEqual(
      ENTITY_ENTRIES.map(([, table]) => `${table}_embedding_enqueue_trg`).sort(),
    );
  });
});
