#!/usr/bin/env node
/**
 * scripts/prisma-resolve-failed-migration.mjs
 *
 * Generic failed-migration guard for `scripts/deploy-{staging,production}.sh`.
 *
 * Prisma refuses to apply any further migration while a previous one is marked
 * failed (P3018/P3009), and `migrate deploy` alone gives no recovery path. This
 * guard runs before `migrate deploy` and:
 *
 *   1. Detects every failed row in `_prisma_migrations`.
 *   2. Runs a registered repair when one exists for that migration.
 *   3. Otherwise aborts with the migration name, its error log, and the
 *      recovery instructions.
 *
 * Most failures are NOT safely auto-repairable: the right fix depends on what
 * the migration actually did before failing. So the default is to stop the
 * deploy and make a human look, not to guess.
 *
 * ## Adding a repair for a new incident
 *
 * Add an entry to `KNOWN_REPAIRS` keyed by the exact migration name. A repair
 * inspects the real partial state and returns:
 *
 *   - "rolled-back" — restore the pre-migration shape; `migrate deploy` will
 *     re-apply the fixed migration SQL.
 *   - "applied"     — the rewrite already committed; finish the remaining
 *     statements and mark the migration applied.
 *
 * Repairs must be idempotent and run their DDL in a transaction.
 *
 * Run through the SSH tunnel: DIRECT_URL must point at 127.0.0.1:<tunnel port>.
 * Uses `pg` (already a dependency) because `psql` is not installed everywhere.
 * Recovery guide: docs/prisma-coolify-migration-runbook.md.
 */
import { execFileSync } from "node:child_process";
import { Client } from "pg";

const MIGRATION_TABLE = "_prisma_migrations";

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error("ERROR: DIRECT_URL is required (must point at the SSH tunnel).");
  process.exit(1);
}

const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Comma-joined enum labels, or null when the type does not exist. */
async function enumLabels(name) {
  const { rows } = await client.query(
    `SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = $1`,
    [name],
  );
  return rows[0]?.labels ?? null;
}

/** Run repair DDL atomically so a half-applied fix cannot happen. */
async function runInTransaction(statements) {
  await client.query("BEGIN");
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Known repair: 20261114120000_restrict_admission_levels_to_research
//
// PostgreSQL refuses `ALTER COLUMN ... TYPE` while a trigger lists the column
// in its `UPDATE OF` set (0A000), and that migration's embedding trigger
// watches `Admission.level`. The migration now drops/recreates the trigger
// around the rewrite. A failed attempt can leave a committed scratch enum
// (`AdmissionLevel_new`) and a dropped `level` default, so the repair inspects
// the real state before acting.
// ---------------------------------------------------------------------------

const ADMISSION = '"public"."Admission"';
const ADMISSION_MIGRATION =
  "20261114120000_restrict_admission_levels_to_research";
const ADMISSION_OLD_LABELS = "PHD,MASTERS,UNDERGRADUATE,MPHIL,OTHER";
const ADMISSION_NEW_LABELS = "PHD,MS_BY_RESEARCH,OTHER";

const ADMISSION_TRIGGER_STATEMENTS = [
  `DROP TRIGGER IF EXISTS "Admission_embedding_enqueue_trg" ON ${ADMISSION}`,
  `CREATE TRIGGER "Admission_embedding_enqueue_trg"
   BEFORE INSERT OR UPDATE OF "university", "department", "level", "description", "isDeleted"
   ON ${ADMISSION}
   FOR EACH ROW
   EXECUTE FUNCTION "public"."enqueue_embedding_job"()`,
];

async function readAdmissionState() {
  const column = await client.query(
    `SELECT t.typname AS udt_name,
            pg_get_expr(d.adbin, d.adrelid) AS default_expr
     FROM pg_attribute a
     JOIN pg_type t ON t.oid = a.atttypid
     LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = $1::regclass
       AND a.attname = 'level'
       AND NOT a.attisdropped`,
    [ADMISSION],
  );

  if (column.rowCount === 0) {
    throw new Error(`column ${ADMISSION}."level" does not exist`);
  }

  const trigger = await client.query(
    `SELECT count(*)::int AS count
     FROM pg_trigger
     WHERE tgrelid = $1::regclass
       AND tgname = 'Admission_embedding_enqueue_trg'
       AND NOT tgisinternal`,
    [ADMISSION],
  );

  return {
    columnType: column.rows[0].udt_name,
    columnDefault: column.rows[0].default_expr,
    oldLabels: await enumLabels("AdmissionLevel"),
    scratchLabels: await enumLabels("AdmissionLevel_new"),
    trigger: trigger.rows[0].count > 0,
  };
}

/** Column is still on the old enum: restore the pre-migration shape. */
async function rollBackAdmissionAttempt(state) {
  if (state.columnType !== "AdmissionLevel") {
    throw new Error(
      `expected ${ADMISSION}."level" to be "AdmissionLevel", found "${state.columnType}"`,
    );
  }
  if (state.oldLabels !== ADMISSION_OLD_LABELS) {
    throw new Error(
      `AdmissionLevel labels are '${state.oldLabels}', expected '${ADMISSION_OLD_LABELS}'`,
    );
  }

  const statements = [];
  if (state.scratchLabels !== null) {
    // Safe: the column still uses the old enum, so nothing can depend on the
    // scratch type. A dependency error here is a genuine reason to abort.
    statements.push('DROP TYPE IF EXISTS "AdmissionLevel_new"');
  }
  statements.push(
    `ALTER TABLE ${ADMISSION} ALTER COLUMN "level" SET DEFAULT 'PHD'`,
  );
  statements.push(...ADMISSION_TRIGGER_STATEMENTS);

  await runInTransaction(statements);
}

/** The type rewrite already committed: finish the remaining statements. */
async function finishAdmissionAttempt(state) {
  if (state.columnType === "AdmissionLevel_new") {
    if (state.scratchLabels !== ADMISSION_NEW_LABELS) {
      throw new Error(
        `AdmissionLevel_new labels are '${state.scratchLabels}', expected '${ADMISSION_NEW_LABELS}'`,
      );
    }

    const statements = [
      `ALTER TABLE ${ADMISSION} ALTER COLUMN "level" DROP DEFAULT`,
    ];
    if (state.oldLabels !== null) {
      statements.push('DROP TYPE "AdmissionLevel"');
    }
    statements.push(
      'ALTER TYPE "AdmissionLevel_new" RENAME TO "AdmissionLevel"',
      `ALTER TABLE ${ADMISSION} ALTER COLUMN "level" SET DEFAULT 'PHD'`,
      ...ADMISSION_TRIGGER_STATEMENTS,
    );

    await runInTransaction(statements);
    return;
  }

  if (state.oldLabels !== ADMISSION_NEW_LABELS) {
    throw new Error(
      `AdmissionLevel labels are '${state.oldLabels}', expected '${ADMISSION_NEW_LABELS}'`,
    );
  }

  // The enum is already renamed; only the default/trigger can be missing.
  await runInTransaction([
    `ALTER TABLE ${ADMISSION} ALTER COLUMN "level" SET DEFAULT 'PHD'`,
    ...ADMISSION_TRIGGER_STATEMENTS,
  ]);
}

async function repairAdmissionLevels() {
  const state = await readAdmissionState();

  console.log(
    `  ${ADMISSION}."level" type: ${state.columnType} (default: ${state.columnDefault ?? "none"})`,
  );
  console.log(
    `  AdmissionLevel: ${state.oldLabels ?? "missing"}; AdmissionLevel_new: ${state.scratchLabels ?? "missing"}; trigger: ${state.trigger ? "present" : "missing"}`,
  );

  if (state.columnType === "AdmissionLevel_new") {
    console.log("  The type rewrite already committed; completing it...");
    await finishAdmissionAttempt(state);
    return "applied";
  }

  if (
    state.columnType === "AdmissionLevel" &&
    state.oldLabels === ADMISSION_NEW_LABELS
  ) {
    console.log("  The enum is already on the new labels; completing it...");
    await finishAdmissionAttempt(state);
    return "applied";
  }

  if (
    state.columnType === "AdmissionLevel" &&
    state.oldLabels === ADMISSION_OLD_LABELS
  ) {
    console.log(
      "  Restoring the pre-migration state (drop scratch enum, restore default and trigger)...",
    );
    await rollBackAdmissionAttempt(state);
    return "rolled-back";
  }

  throw new Error(
    `unexpected state (column=${state.columnType}, labels=${state.oldLabels ?? "missing"}); refusing to guess`,
  );
}

const KNOWN_REPAIRS = {
  [ADMISSION_MIGRATION]: {
    description:
      "AdmissionLevel enum rewrite hit the embedding-trigger dependency (P3018/0A000)",
    repair: repairAdmissionLevels,
  },
};

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

async function findFailedMigrations() {
  const { rows } = await client.query(
    `SELECT migration_name,
            started_at,
            left(coalesce(logs, ''), 4000) AS logs
     FROM "${MIGRATION_TABLE}"
     WHERE finished_at IS NULL AND rolled_back_at IS NULL
     ORDER BY started_at`,
  );
  return rows;
}

function printRecoveryInstructions(migrationName) {
  console.error("ERROR: migration is marked failed and has no registered repair.");
  console.error("       Prisma will not apply any further migrations until it is resolved.");
  console.error("       Fix the migration SQL, then either:");
  console.error(
    "         - add an entry to KNOWN_REPAIRS in scripts/prisma-resolve-failed-migration.mjs, or",
  );
  console.error(
    `         - run: npx prisma migrate resolve --rolled-back ${migrationName}`,
  );
  console.error("       Recovery guide: docs/prisma-coolify-migration-runbook.md");
  console.error("       Never run prisma migrate reset or db push against this database.");
}

async function guard() {
  await client.connect();

  let action = null;
  let migrationName = null;

  try {
    const failed = await findFailedMigrations();

    if (failed.length === 0) {
      console.log("  No failed migrations.");
      return;
    }

    if (failed.length > 1) {
      console.error("ERROR: multiple migrations are marked failed:");
      for (const row of failed) {
        console.error(`  - ${row.migration_name} (started ${row.started_at.toISOString()})`);
      }
      console.error("       Resolve them one at a time; see docs/prisma-coolify-migration-runbook.md.");
      process.exitCode = 1;
      return;
    }

    const row = failed[0];
    const known = KNOWN_REPAIRS[row.migration_name];

    console.log(
      `  Migration ${row.migration_name} is marked failed (started ${row.started_at.toISOString()}).`,
    );
    if (row.logs) {
      const tail = row.logs
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-3)
        .join(" | ");
      console.log(`  Error: ${tail}`);
    }

    if (!known) {
      printRecoveryInstructions(row.migration_name);
      process.exitCode = 1;
      return;
    }

    console.log(`  Applying known repair: ${known.description}`);
    action = await known.repair();
    migrationName = row.migration_name;
  } finally {
    await client.end().catch(() => {});
  }

  if (!action) return;

  console.log(
    `  Marking ${migrationName} as ${action === "applied" ? "applied" : "rolled back"}...`,
  );
  execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "resolve",
      action === "applied" ? "--applied" : "--rolled-back",
      migrationName,
    ],
    { stdio: "inherit" },
  );
}

try {
  await guard();
} catch (error) {
  // 42P01 = undefined_table: a brand-new database has no migration history yet.
  if (error && typeof error === "object" && error.code === "42P01") {
    console.log("  No _prisma_migrations table; nothing to guard.");
    process.exit(0);
  }
  console.error(
    `ERROR: failed-migration guard could not run: ${error instanceof Error ? error.message : String(error)}`,
  );
  console.error("       _prisma_migrations was left untouched. Inspect the database manually.");
  process.exit(1);
}
