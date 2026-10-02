import { expect, test, type Page } from "@playwright/test";
import { moveRightWithKeyboard, pickUpAndDropInPlace } from "./keyboard-move";
import { parseStoredInstant, resetBoard, storedInstant, withDatabase } from "./reset-board";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Seeded Applied, far past the threshold — the positive case, already in the seed. */
const STALE = { id: "e2e-applied", company: "Acme Cloud" };
/** Seeded Wishlist and also old — the negative the rule most easily gets wrong. */
const OLD_ELSEWHERE = { id: "e2e-wishlist", company: "Northwind Labs" };

function column(page: Page, name: string) {
  return page.getByRole("region", { name });
}

function card(page: Page, columnName: string, company: string) {
  return column(page, columnName).getByRole("article", { name: company });
}

/**
 * The visible pill, not the announced sentence.
 *
 * `exact` matters: `getByText` matches substrings, so "No movement" alone
 * resolves to both the `aria-hidden` pill and the `.sr-only`
 * "No movement for 14 days or more" and trips strict mode. Declared once here
 * rather than spelled out at every call site.
 */
function visibleFlag(scope: ReturnType<typeof card>) {
  return scope.getByText("No movement", { exact: true });
}

/**
 * Inserts a card of a controlled age.
 *
 * The half-day offset is what makes the boundary cases safe whenever the run
 * happens: the seeded instants sit on 09:00:00Z and both the test process's
 * clock and the server's request instant floor against that edge, so twelve
 * hours of slack keeps the flooring unambiguous.
 */
function insertAgedApplication(
  id: string,
  company: string,
  status: string,
  days: number,
  extraHours = 12,
): void {
  withDatabase((db) => {
    const now = Date.now();
    const changed = now - days * DAY - extraHours * HOUR;
    db.prepare(
      `INSERT INTO JobApplication
         (id, company, position, status, link, notes, appliedDate, statusChangedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
    ).run(
      id,
      company,
      "Developer",
      status,
      storedInstant(changed),
      storedInstant(changed),
      storedInstant(now),
    );
  });
}

function storedStatusChangedAt(id: string): number {
  return withDatabase((db) => {
    const row = db
      .prepare("SELECT statusChangedAt AS at FROM JobApplication WHERE id = ?")
      .get(id) as { at: string | number };
    return parseStoredInstant(row.at);
  });
}

test.beforeEach(() => {
  resetBoard();
});

test.afterAll(() => {
  resetBoard();
});

test("flags the stale Applied card and not the old one in Wishlist", async ({ page }) => {
  await page.goto("/");

  // Both halves of the rule on one board: Applied and old is flagged, old in
  // another column is not. The second is the half most easily lost.
  await expect(visibleFlag(card(page, "Applied", STALE.company))).toBeVisible();
  await expect(
    visibleFlag(card(page, "Wishlist", OLD_ELSEWHERE.company)),
  ).toHaveCount(0);
});

test("announces the flag as what it means", async ({ page }) => {
  await page.goto("/");

  await expect(
    card(page, "Applied", STALE.company).getByText("No movement for 14 days or more"),
  ).toBeAttached();
});

test("flags a card at exactly the threshold", async ({ page }) => {
  insertAgedApplication("e2e-at-threshold", "Vandelay Industries", "APPLIED", 14);

  await page.goto("/");

  const target = card(page, "Applied", "Vandelay Industries");
  await expect(target.getByText("14d")).toBeVisible();
  await expect(visibleFlag(target)).toBeVisible();
});

test("does not flag a card a day short of the threshold", async ({ page }) => {
  insertAgedApplication("e2e-under-threshold", "Pendant Publishing", "APPLIED", 13);

  await page.goto("/");

  const target = card(page, "Applied", "Pendant Publishing");
  await expect(target.getByText("13d")).toBeVisible();
  await expect(visibleFlag(target)).toHaveCount(0);
});

test("stops flagging a card moved out of Applied, before and after a reload", async ({ page }) => {
  await page.goto("/");
  await expect(visibleFlag(card(page, "Applied", STALE.company))).toBeVisible();

  await moveRightWithKeyboard(page, STALE.company, "INTERVIEW");

  const moved = card(page, "Interview", STALE.company);
  await expect(moved).toBeVisible();
  // Without a reload: the optimistic move sets both fields the rule reads.
  await expect(visibleFlag(moved)).toHaveCount(0);

  await page.reload();
  await expect(
    visibleFlag(card(page, "Interview", STALE.company)),
  ).toHaveCount(0);
});

test("keeps the flag on a card dropped in its own column", async ({ page }) => {
  // planCardMove returns null for a drop on the card's own column, so no write
  // is made and the clock is not reset. Without this, a later change making it
  // return a move would silently unflag every stale card somebody picked up and
  // put back down.
  const before = storedStatusChangedAt(STALE.id);
  await page.goto("/");

  await pickUpAndDropInPlace(page, STALE.company);

  await expect(visibleFlag(card(page, "Applied", STALE.company))).toBeVisible();
  expect(storedStatusChangedAt(STALE.id)).toBe(before);

  await page.reload();
  await expect(visibleFlag(card(page, "Applied", STALE.company))).toBeVisible();
});
