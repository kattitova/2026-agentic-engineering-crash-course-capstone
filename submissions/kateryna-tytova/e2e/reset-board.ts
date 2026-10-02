import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const E2E_DB = "e2e.db";

/**
 * The snapshot `npm run e2e:db` writes beside the database: every column of
 * every seeded row, exactly as SQLite stored it.
 */
export const SEED_SNAPSHOT = "e2e-seed.json";

/** One row as better-sqlite3 hands it back — the storage values, not Prisma's. */
type Row = Record<string, string | number | bigint | Buffer | null>;

/**
 * Puts the seeded rows back exactly as the seeder left them, without resetting
 * the schema.
 *
 * Restores from the snapshot rather than from a list of ids and statuses. The
 * earlier version only wrote `status` back and deleted anything extra, which
 * could not undo the two things MVP item 4 introduced: an edit changes company,
 * position, link or notes, and a deletion removes a seeded row altogether. Both
 * leave the next test — and the next run — a different board.
 *
 * Reading the snapshot from disk rather than caching it in memory is what keeps
 * that true after Playwright restarts a worker, which it does on a failure: a
 * snapshot taken lazily in-process would then be taken from an already-mutated
 * database.
 */
export function resetBoard(): void {
  const rows = JSON.parse(readFileSync(SEED_SNAPSHOT, "utf8")) as Row[];
  const first = rows[0];
  if (first === undefined) {
    throw new Error(`${SEED_SNAPSHOT} holds no rows; run \`npm run e2e:db\``);
  }

  const columns = Object.keys(first);
  const insert = `INSERT INTO JobApplication (${columns.join(", ")}) VALUES (${columns
    .map(() => "?")
    .join(", ")})`;

  const db = new Database(E2E_DB);
  try {
    // One transaction, so a test can never observe an empty board: the delete
    // and the re-insert land together.
    db.transaction(() => {
      db.prepare("DELETE FROM JobApplication").run();
      const statement = db.prepare(insert);
      for (const row of rows) {
        statement.run(columns.map((column) => row[column] ?? null));
      }
    })();
  } finally {
    db.close();
  }
}

/**
 * A `DateTime` in the form Prisma 7 stores it in SQLite: ISO text with an
 * explicit offset, not epoch milliseconds.
 *
 * A spec that inserts its own row has to match this. Writing a number happens
 * to work — Prisma coerces it on the way out — but it makes the test exercise a
 * row shape the application never produces, and it makes the value unusable to
 * any assertion that compares instants.
 */
export function storedInstant(ms: number): string {
  return `${new Date(ms).toISOString().replace("Z", "+00:00")}`;
}

/** The inverse, for an assertion that needs to compare two stored instants. */
export function parseStoredInstant(value: string | number): number {
  return typeof value === "number" ? value : Date.parse(value);
}

/** Opens the shared e2e database for a test that needs to assert on rows. */
export function withDatabase<T>(query: (db: Database.Database) => T): T {
  const db = new Database(E2E_DB);
  try {
    return query(db);
  } finally {
    db.close();
  }
}
