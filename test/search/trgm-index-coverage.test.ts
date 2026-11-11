import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ContentListArgs } from "@/lib/tri-split/content";
import {
  CONTENT_LIST_CONFIGS,
  CONTENT_LIST_KEYS,
  type ContentListKey,
} from "@/lib/tri-split/modules/registry";
import { ENTITY_CONFIG } from "@/lib/transactions";

/**
 * Locks the SQL inventory to the application's declarative search config.
 *
 * The list search is one Prisma `OR`; PostgreSQL only builds a BitmapOr when
 * every branch is indexable. Adding a `searchFields` entry without a matching
 * `..._trgm_idx` therefore silently downgrades that whole module to a
 * sequential scan. This test turns that into a failing unit test instead of a
 * production surprise.
 */
const MIGRATION_PATH = join(
  process.cwd(),
  "prisma/migrations/20261031120000_search_trgm_indexes/migration.sql",
);
const MIGRATION =
  readFileSync(MIGRATION_PATH, "utf8") +
  readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261110180000_rename_research_events_to_call_for_papers/migration.sql",
    ),
    "utf8",
  );

function hasIndex(name: string): boolean {
  return new RegExp(`CREATE INDEX IF NOT EXISTS "${name}"`).test(MIGRATION);
}

type SearchField = { field: string; relation?: string };

type DirectoryVariant = {
  rowTable: string;
  searchFields?: readonly SearchField[];
};

type RegistryEntry = ContentListArgs & {
  variants?: readonly DirectoryVariant[];
};

function searchTargets(key: ContentListKey): {
  table: string;
  fields: readonly SearchField[];
}[] {
  const config = CONTENT_LIST_CONFIGS[key] as unknown as RegistryEntry;

  // The scholar directory is the one list keyed by orderings rather than a
  // single module; both variants declare the same User fields.
  if (config.variants) {
    return config.variants.map((variant) => ({
      table: variant.rowTable,
      fields: variant.searchFields ?? [],
    }));
  }

  const model = ENTITY_CONFIG[config.module].model;
  return [
    {
      table: model.charAt(0).toUpperCase() + model.slice(1),
      fields: config.searchFields ?? [],
    },
  ];
}

describe("trigram search index coverage", () => {
  it("creates pg_trgm", () => {
    expect(MIGRATION).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm/);
  });

  it("indexes every declared list search field", () => {
    for (const key of CONTENT_LIST_KEYS) {
      for (const { table, fields } of searchTargets(key)) {
        for (const { field, relation } of fields) {
          // Author fields live on User, not on the content table.
          const indexTable = relation === "author" ? "User" : table;
          const indexName = `${indexTable}_${field}_trgm_idx`;
          expect(hasIndex(indexName), `${key} -> ${indexName}`).toBe(true);
        }
      }
    }
  });

  it("indexes both picker search paths, including prefix and full-text", () => {
    const pickerIndexes = [
      "User_name_trgm_idx",
      "User_handle_trgm_idx",
      "User_bio_trgm_idx",
      "User_search_text_gin_idx",
      "User_handle_lower_prefix_idx",
      "Journal_title_trgm_idx",
      "Journal_publisher_trgm_idx",
      "Journal_about_trgm_idx",
      "Journal_issn_trgm_idx",
      "Journal_search_text_gin_idx",
      "Journal_issn_lower_prefix_idx",
    ];

    for (const indexName of pickerIndexes) {
      expect(hasIndex(indexName), indexName).toBe(true);
    }
  });
});
