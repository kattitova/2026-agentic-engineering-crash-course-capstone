import Database from "better-sqlite3";

const E2E_DB = "e2e.db";

/** The statuses `npm run e2e:db` leaves behind. */
export const SEEDED = {
  "e2e-wishlist": "WISHLIST",
  "e2e-applied": "APPLIED",
  "e2e-interview": "INTERVIEW",
} as const;

/**
 * Puts the seeded rows back where the seeder left them, without resetting the
 * schema, and removes anything a test added. Each spec mutates the one shared
 * database, so without this the order of the tests would decide whether they
 * pass, and a run that adds an application would leave the next run a different
 * board.
 */
export function resetBoard(): void {
  const db = new Database(E2E_DB);
  try {
    const update = db.prepare("UPDATE JobApplication SET status = ? WHERE id = ?");
    for (const [id, status] of Object.entries(SEEDED)) {
      update.run(status, id);
    }
    const placeholders = Object.keys(SEEDED).map(() => "?").join(", ");
    db.prepare(`DELETE FROM JobApplication WHERE id NOT IN (${placeholders})`).run(
      ...Object.keys(SEEDED),
    );
  } finally {
    db.close();
  }
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
