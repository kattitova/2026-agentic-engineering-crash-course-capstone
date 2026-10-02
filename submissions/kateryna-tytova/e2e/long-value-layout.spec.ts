import { expect, test, type Page } from "@playwright/test";
import { resetBoard, storedInstant, withDatabase } from "./reset-board";

const COLUMNS = ["Wishlist", "Applied", "Interview", "Offer", "Rejected"] as const;

/**
 * Longer than the form will accept - APPLICATION_LIMITS caps company at 120 -
 * which is the point: this is the value the interface cannot produce and the
 * database can still hold. A single unbroken word, as the spec scenario says.
 */
const LONG = "A".repeat(200);

/**
 * Fractional CSS pixels: a grid dividing its container by five rarely lands on
 * integers. 1px is far below the ~600px a real layout break produces, so do not
 * tighten this - it would buy nothing and cost a flake.
 */
const TOLERANCE = 1;

async function columnWidths(page: Page): Promise<number[]> {
  const widths: number[] = [];
  for (const name of COLUMNS) {
    const box = await page.getByRole("region", { name }).boundingBox();
    expect(box, `column ${name} has no box`).not.toBeNull();
    // Here rather than in one test, so neither caller can compare a pair of
    // zeroes and read it as "the width did not change".
    expect(box?.width ?? 0, `column ${name} is too narrow to be real`).toBeGreaterThan(100);
    widths.push(box?.width ?? 0);
  }
  return widths;
}

/** True when the page can be scrolled sideways, which the board must never be. */
function scrollsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
}

test.beforeEach(() => {
  resetBoard();
});

// Without this the inserted 200-character row outlives the file, and whether it
// is cleaned up depends on another spec running afterwards - measured: running
// this file alone leaves e2e-long-value in the database.
test.afterAll(() => {
  resetBoard();
});

test("the board starts with equal columns and no sideways scroll", async ({ page }) => {
  // The control for the long-value test below. A before-and-after comparison
  // passes when both are equally wrong, so the "before" has to be asserted in
  // its own right or "unchanged" means nothing.
  await page.goto("/");

  // columnWidths asserts each is a real width, so a selector that matched
  // nothing cannot read as five equal columns.
  const widths = await columnWidths(page);

  for (const width of widths) {
    expect(Math.abs(width - (widths[0] ?? 0))).toBeLessThanOrEqual(TOLERANCE);
  }

  expect(await scrollsHorizontally(page)).toBe(false);
});

/** Puts one application on the board that the form could never have created. */
function insertLongValueApplication(): void {
  withDatabase((db) => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO JobApplication
         (id, company, position, status, link, notes, appliedDate, statusChangedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
    ).run(
      "e2e-long-value",
      LONG,
      LONG,
      "WISHLIST",
      storedInstant(now),
      storedInstant(now),
      storedInstant(now),
    );
  });
}

/**
 * A card whose badge is as wide as the badge can get.
 *
 * Its own row rather than folded into the long-value one: that card sets
 * `statusChangedAt` to now, so its badge reads "Today" - the shortest value
 * there is - and proves nothing about a wide one. And a single card carrying
 * both a 200-character name and a four-digit badge would be one measurement
 * with two possible causes, which could not say which of them moved a column.
 * The same reason this spec keeps a separate control test.
 */
function insertLargeBadgeApplication(): void {
  withDatabase((db) => {
    const now = Date.now();
    const ancient = now - 5000 * 24 * 60 * 60 * 1000;
    db.prepare(
      `INSERT INTO JobApplication
         (id, company, position, status, link, notes, appliedDate, statusChangedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
    ).run(
      "e2e-large-badge",
      "Initrode",
      "Analyst",
      "OFFER",
      storedInstant(ancient),
      storedInstant(ancient),
      storedInstant(now),
    );
  });
}

test("a four-digit day count does not change any column's width", async ({ page }) => {
  await page.goto("/");
  const before = await columnWidths(page);
  expect(await scrollsHorizontally(page)).toBe(false);

  insertLargeBadgeApplication();
  await page.reload();

  // The card is really there with the wide badge, so the measurement is of a
  // board that holds it rather than of one that dropped the row.
  const offer = page.getByRole("region", { name: "Offer" });
  await expect(offer.getByText("5000d")).toBeVisible();
  await expect(offer.getByText("5000 days in Offer")).toBeAttached();

  const after = await columnWidths(page);
  for (const [index, width] of after.entries()) {
    expect(
      Math.abs(width - (before[index] ?? 0)),
      `column ${COLUMNS[index]} changed width`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }

  expect(await scrollsHorizontally(page)).toBe(false);
});

/**
 * A stale card, so the row holds two pills instead of one.
 *
 * An ordinary company name on purpose: this is the flag measured alone. The
 * combined case — stale *and* a 200-character name — is the row after it, and
 * they are separate for the reason this file's control test already records:
 * one measurement with two possible causes cannot say which of them moved a
 * column.
 */
function insertStaleApplication(id: string, company: string): void {
  withDatabase((db) => {
    const now = Date.now();
    const stale = now - 30 * 24 * 60 * 60 * 1000;
    db.prepare(
      `INSERT INTO JobApplication
         (id, company, position, status, link, notes, appliedDate, statusChangedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
    ).run(
      id,
      company,
      "Analyst",
      "APPLIED",
      storedInstant(stale),
      storedInstant(stale),
      storedInstant(now),
    );
  });
}

test("a flagged card does not change any column's width", async ({ page }) => {
  await page.goto("/");
  const before = await columnWidths(page);
  expect(await scrollsHorizontally(page)).toBe(false);

  insertStaleApplication("e2e-stale-layout", "Bluth Company");
  await page.reload();

  // The flag is really on the board, so the measurement is of a board that
  // holds it rather than of one that dropped the row.
  const applied = page.getByRole("region", { name: "Applied" });
  await expect(
    applied.getByRole("article", { name: "Bluth Company" }).getByText("No movement", { exact: true }),
  ).toBeVisible();

  const after = await columnWidths(page);
  for (const [index, width] of after.entries()) {
    expect(
      Math.abs(width - (before[index] ?? 0)),
      `column ${COLUMNS[index]} changed width`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }

  expect(await scrollsHorizontally(page)).toBe(false);
});

test("a flagged card with a long unbroken name does not change any column's width", async ({
  page,
}) => {
  await page.goto("/");
  const before = await columnWidths(page);
  expect(await scrollsHorizontally(page)).toBe(false);

  insertStaleApplication("e2e-stale-long", LONG);
  await page.reload();

  const applied = page.getByRole("region", { name: "Applied" });
  await expect(applied.getByRole("heading", { name: LONG })).toBeVisible();
  await expect(
    applied.getByRole("article", { name: LONG }).getByText("No movement", { exact: true }),
  ).toBeVisible();

  const after = await columnWidths(page);
  for (const [index, width] of after.entries()) {
    expect(
      Math.abs(width - (before[index] ?? 0)),
      `column ${COLUMNS[index]} changed width`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }

  expect(await scrollsHorizontally(page)).toBe(false);
});

test("a long unbroken value does not change any column's width", async ({ page }) => {
  await page.goto("/");
  const before = await columnWidths(page);
  expect(await scrollsHorizontally(page)).toBe(false);

  insertLongValueApplication();
  await page.reload();

  // The card is really there, so the measurement is of a board that holds the
  // value rather than of one that silently dropped it.
  const wishlist = page.getByRole("region", { name: "Wishlist" });
  const heading = wishlist.getByRole("heading", { name: LONG });
  await expect(heading).toBeVisible();

  // The requirement's own sentence - "SHALL NOT change the width of its column"
  // - as a comparison rather than as an absolute number.
  const after = await columnWidths(page);
  for (const [index, width] of after.entries()) {
    expect(
      Math.abs(width - (before[index] ?? 0)),
      `column ${COLUMNS[index]} changed width`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }

  // What removing the clamp actually does. The clamp implies overflow:hidden,
  // which is what lets the flex item shrink below its content width; without it
  // the h3 keeps its min-content width and the row overflows while the grid
  // tracks stay equal.
  //
  // Measured with line-clamp-3 removed from the company: the h3's own right edge
  // lands at 2053px while its column ends at 268px, and the document's
  // scrollWidth is 2087px in both projects - 807px of overflow at 1280, 987px at
  // 1100. The 2026-09-27 note recorded 613px at 1440px, which is the same
  // content measured against a wider viewport.
  //
  // Both this assertion and the bounding-box one below catch that mutation. It
  // is the width comparison above that passes, which is why it is not the only
  // measurement here. Checked by running the box assertions first, because hard
  // assertions stop at the first failure and would otherwise hide it.
  expect(await scrollsHorizontally(page)).toBe(false);

  // And the value itself stays inside its column, in case it paints outside the
  // card without moving anything.
  const column = await wishlist.boundingBox();
  const text = await heading.boundingBox();
  expect(column).not.toBeNull();
  expect(text).not.toBeNull();
  expect(text?.x ?? 0).toBeGreaterThanOrEqual((column?.x ?? 0) - TOLERANCE);
  expect((text?.x ?? 0) + (text?.width ?? 0)).toBeLessThanOrEqual(
    (column?.x ?? 0) + (column?.width ?? 0) + TOLERANCE,
  );
});
