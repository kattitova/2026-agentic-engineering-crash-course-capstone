import { expect, test, type Page } from "@playwright/test";
import { moveRightWithKeyboard, pickUpAndDropInPlace } from "./keyboard-move";
import { parseStoredInstant, resetBoard, storedInstant, withDatabase } from "./reset-board";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Seeded in Interview by `npm run e2e:db`. */
const INTERVIEW = { id: "e2e-interview", company: "Globex" };

function column(page: Page, name: string) {
  return page.getByRole("region", { name });
}

/**
 * Inserts a card of a controlled age.
 *
 * `extraHours` is what makes the expectation safe whenever the run happens. The
 * seeded rows sit on 09:00:00Z, and both the test process's clock and the
 * server's request instant floor against that same edge — so a run straddling
 * 09:00 UTC would read one number here and another there. Half a day of offset
 * puts the flooring boundary twelve hours from either clock. A hardcoded number
 * against the fixed seed would be worse still: it would be wrong by one more
 * every real day.
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

/**
 * The stored moment as milliseconds, so a test can compare two of them.
 *
 * Parsed rather than read raw: Prisma stores a DateTime as ISO text, and
 * comparing those as strings is a comparison of spellings.
 */
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

test("shows how many whole days a card has been in its status", async ({ page }) => {
  insertAgedApplication("e2e-aged", "Vandelay Industries", "APPLIED", 12);

  await page.goto("/");

  const applied = column(page, "Applied");
  const card = applied.getByRole("article", { name: "Vandelay Industries" });
  await expect(card.getByText("12d")).toBeVisible();
  // The announced form, which names the status rather than saying "this status".
  await expect(card.getByText("12 days in Applied")).toBeAttached();
});

test("shows a higher count once the card has been in its status longer", async ({ page }) => {
  // The count is recomputed from the stored moment on every request, not frozen
  // into the page. Ageing the row rather than waiting a day is the same
  // measurement: what must not happen is the board serving yesterday's number.
  insertAgedApplication("e2e-ageing", "Sirius Cybernetics", "REJECTED", 12);
  await page.goto("/");

  const rejected = column(page, "Rejected");
  await expect(
    rejected.getByRole("article", { name: "Sirius Cybernetics" }).getByText("12d"),
  ).toBeVisible();

  withDatabase((db) => {
    db.prepare("UPDATE JobApplication SET statusChangedAt = ? WHERE id = ?").run(
      storedInstant(Date.now() - 13 * DAY - 12 * HOUR),
      "e2e-ageing",
    );
  });
  await page.reload();

  const card = column(page, "Rejected").getByRole("article", { name: "Sirius Cybernetics" });
  await expect(card.getByText("13d")).toBeVisible();
  await expect(card.getByText("13 days in Rejected")).toBeAttached();
});

test("says today rather than zero days for a card under a day old", async ({ page }) => {
  insertAgedApplication("e2e-fresh", "Pendant Publishing", "WISHLIST", 0, 20);

  await page.goto("/");

  const card = column(page, "Wishlist").getByRole("article", { name: "Pendant Publishing" });
  // 20 hours is a previous calendar date and still not a whole day, which is the
  // case that separates elapsed days from calendar days.
  await expect(card.getByText("Today", { exact: true })).toBeVisible();
  await expect(card.getByText("Today in Wishlist")).toBeAttached();
});

test("uses the singular for exactly one day", async ({ page }) => {
  insertAgedApplication("e2e-one-day", "Kruger Industrial", "OFFER", 1);

  await page.goto("/");

  const card = column(page, "Offer").getByRole("article", { name: "Kruger Industrial" });
  await expect(card.getByText("1 day in Offer")).toBeAttached();
  await expect(card.getByText("1 days in Offer")).toHaveCount(0);
});

test("a moved card reads as today in its new column, and still does after a reload", async ({
  page,
}) => {
  const before = storedStatusChangedAt(INTERVIEW.id);
  await page.goto("/");

  const interview = column(page, "Interview");
  await expect(interview.getByRole("article", { name: INTERVIEW.company })).toBeVisible();

  // The shared helper, not three bare key presses: each of its waits was paid
  // for by a flake, and pressing the keys back to back races the sensor so the
  // drag silently never starts.
  await moveRightWithKeyboard(page, INTERVIEW.company, "OFFER");

  const offer = column(page, "Offer");
  const moved = offer.getByRole("article", { name: INTERVIEW.company });
  await expect(moved).toBeVisible();
  // Without a reload: the optimistic move stamps the served instant onto the
  // card, so it reads as newly arrived rather than carrying its old count into
  // a column it has just reached.
  await expect(moved.getByText("Today in Offer")).toBeAttached();

  await page.reload();
  const afterReload = column(page, "Offer").getByRole("article", { name: INTERVIEW.company });
  await expect(afterReload.getByText("Today in Offer")).toBeAttached();

  // And the stored clock really was reset, which the badge alone cannot prove.
  expect(storedStatusChangedAt(INTERVIEW.id)).toBeGreaterThan(before);
});

test("a card dropped in its own column keeps its count", async ({ page }) => {
  insertAgedApplication("e2e-same-column", "Bluth Company", "OFFER", 12);
  const before = storedStatusChangedAt("e2e-same-column");

  await page.goto("/");
  const card = column(page, "Offer").getByRole("article", { name: "Bluth Company" });
  await expect(card.getByText("12 days in Offer")).toBeAttached();

  // Picked up and put down without choosing a column: planCardMove returns null
  // for this, so no write is made and the clock is not reset.
  await pickUpAndDropInPlace(page, "Bluth Company");

  const after = column(page, "Offer").getByRole("article", { name: "Bluth Company" });
  await expect(after.getByText("12 days in Offer")).toBeAttached();

  await page.reload();
  await expect(
    column(page, "Offer").getByRole("article", { name: "Bluth Company" }).getByText("12d"),
  ).toBeVisible();
  // The observable half of "the clock was not reset".
  expect(storedStatusChangedAt("e2e-same-column")).toBe(before);
});

test("every card carries exactly one badge", async ({ page }) => {
  await page.goto("/");

  const cards = await page.getByRole("article").count();
  expect(cards).toBeGreaterThan(0);
  // One per card: the announced form always contains "in <status>".
  const badges = await page.locator("article").getByText(/ in (Wishlist|Applied|Interview|Offer|Rejected)$/).count();
  expect(badges).toBe(cards);
});
