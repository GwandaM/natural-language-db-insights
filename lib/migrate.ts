import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import "dotenv/config";
import { sql } from "@/lib/db";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const FILE_PATTERN = /^(\d{3,})_[a-z0-9_\-]+\.sql$/i;
const TEMPLATE_PREFIX = "000_";

type AppliedRow = { filename: string };

async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function appliedSet(): Promise<Set<string>> {
  const { rows } = await sql.query<AppliedRow>(
    "SELECT filename FROM schema_migrations",
  );
  return new Set(rows.map((r) => r.filename));
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => FILE_PATTERN.test(f) && !f.startsWith(TEMPLATE_PREFIX))
    .sort();
}

function looksTransactional(source: string): boolean {
  // Treat the file as self-managed if it already contains BEGIN;
  // Otherwise wrap the whole thing in a single transaction.
  return /^\s*BEGIN\s*;/im.test(source);
}

async function applyFile(filename: string) {
  const fullPath = join(MIGRATIONS_DIR, filename);
  const source = readFileSync(fullPath, "utf8");

  if (looksTransactional(source)) {
    // File manages its own transaction boundaries (BEGIN/COMMIT) or
    // intentionally runs statements outside a transaction (e.g. CREATE
    // INDEX CONCURRENTLY). Execute as-is.
    await sql.query(source);
  } else {
    await sql.query(`BEGIN;\n${source}\nCOMMIT;`);
  }

  await sql`INSERT INTO schema_migrations (filename) VALUES (${filename})`;
}

export async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await appliedSet();
  const files = listMigrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  console.log(`Applying ${pending.length} migration(s):`);
  for (const f of pending) {
    process.stdout.write(`  - ${f} ... `);
    try {
      await applyFile(f);
      console.log("done");
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      process.exit(1);
    }
  }
  console.log("All migrations applied.");
}

export async function printStatus() {
  await ensureMigrationsTable();
  const applied = await appliedSet();
  const files = listMigrationFiles();

  console.log("filename                                           status");
  console.log("-------------------------------------------------- ----------");
  for (const f of files) {
    const status = applied.has(f) ? "applied" : "pending";
    console.log(f.padEnd(50), status);
  }

  const orphans = [...applied].filter((f) => !files.includes(f));
  if (orphans.length > 0) {
    console.log("");
    console.log("Applied in DB but missing on disk:");
    for (const f of orphans) console.log(`  - ${f}`);
  }
}

async function main() {
  const cmd = process.argv[2] ?? "up";
  if (cmd === "up") {
    await runMigrations();
  } else if (cmd === "status") {
    await printStatus();
  } else {
    console.error(`Unknown command: ${cmd}. Use "up" or "status".`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
