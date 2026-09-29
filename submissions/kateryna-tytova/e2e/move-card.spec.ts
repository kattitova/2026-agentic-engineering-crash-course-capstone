import { expect, test, type Page } from "@playwright/test";
import { resetBoard, withDatabase } from "./reset-board";

/**
 * Waits until the board can actually be driven.
 *
 * dnd-kit renders its live region into the body only on the client, so it is
 * absent from the server HTML and appearing is exactly "React has hydrated and
 * the sensors are listening". Without this the first test presses keys against
 * markup that is still inert, and the drag never starts.
 */
async function waitForBoardReady(page: Page): Promise<void> {
  await page.locator("[id^=DndLiveRegion]").waitFor({ state: "attached" });
}

function column(page: Page, name: string) {
  return page.getByRole("region", { name });
}

async function cardCount(page: Page, name: string): Promise<number> {
  return column(page, name).locator("article").count();
}

/**
 * Moves the focused card one column to the right with the keyboard alone.
 *
 * Each step waits for dnd-kit to announce it rather than for a fixed delay.
 * Pressing the three keys back to back races the sensor and the drag silently
 * never starts; the announcements are the sensor telling us it is ready for the
 * next one, so they are both the synchronisation and the assertion that the
 * keyboard path really went through pick up -> choose column -> drop.
 */
async function moveRightWithKeyboard(
  page: Page,
  company: string,
  targetStatus: string,
): Promise<void> {
  await waitForBoardReady(page);
  const announcements = page.locator("[id^=DndLiveRegion]");

  await page.getByRole("button", { name: `Move ${company}` }).focus();
  await page.keyboard.press("Space");
  await expect(announcements).toContainText(/moved over droppable area/i);

  // dnd-kit attaches its keydown listener inside a setTimeout
  // (@dnd-kit/core/dist/core.cjs.development.js:1163), so for one macrotask the
  // drag is already active - announced, aria-pressed - while no listener exists
  // and an arrow key is silently dropped. Observed as a 3-in-15 flake in which
  // the coordinate getter was never called at all. Yielding one macrotask here
  // is ordered after theirs, because theirs was queued first.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));

  await page.keyboard.press("ArrowRight");
  await expect(announcements).toContainText(
    new RegExp(`moved over droppable area ${targetStatus}`, "i"),
  );

  await page.keyboard.press("Space");
  await expect(announcements).toContainText(/was dropped over/i);
}

test.beforeEach(() => {
  resetBoard();
});

test("moves a card to the next column with the keyboard", async ({ page }) => {
  await page.goto("/");

  expect(await cardCount(page, "Applied")).toBe(1);
  expect(await cardCount(page, "Interview")).toBe(1);

  await moveRightWithKeyboard(page, "Acme Cloud", "INTERVIEW");

  await expect(column(page, "Interview").getByText("Acme Cloud")).toBeVisible();
  await expect(column(page, "Applied").getByText("Acme Cloud")).toHaveCount(0);

  // The counts are a separate rendering path from the cards, so they are worth
  // asserting rather than assuming.
  await expect(column(page, "Applied").getByText("0 applications")).toBeVisible();
  await expect(column(page, "Interview").getByText("2 applications")).toBeVisible();
});

test("leaves focus on the moved card after a keyboard move", async ({ page }) => {
  // Completing a move disables the handle and then remounts the card under
  // another column, so without restoring focus the keyboard user lands on the
  // document body and has to tab in from the top of the page.
  await page.goto("/");
  await moveRightWithKeyboard(page, "Acme Cloud", "INTERVIEW");

  await expect(
    page.getByRole("button", { name: "Move Acme Cloud" }),
  ).toBeFocused();
});

test("the move survives a reload", async ({ page }) => {
  await page.goto("/");
  await moveRightWithKeyboard(page, "Acme Cloud", "INTERVIEW");
  await expect(column(page, "Interview").getByText("Acme Cloud")).toBeVisible();

  await page.reload();

  await expect(column(page, "Interview").getByText("Acme Cloud")).toBeVisible();
  await expect(column(page, "Applied").getByText("Acme Cloud")).toHaveCount(0);
});

test("reads the data per request, not at build time", async ({ page }) => {
  // The guard for `await connection()` in lib/applications/queries.ts. Prisma
  // runs on better-sqlite3, a synchronous driver, so without it the query
  // completes during prerendering and the board is frozen at build time. Remove
  // that line and this test fails while every unit test stays green.
  await page.goto("/");
  await expect(page.getByText("Inserted Behind The Board")).toHaveCount(0);

  withDatabase((db) => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO JobApplication
         (id, company, position, status, link, notes, appliedDate, statusChangedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`,
    ).run("e2e-direct", "Inserted Behind The Board", "Reliability Engineer", "OFFER", now, now, now);
  });

  await page.reload();

  await expect(column(page, "Offer").getByText("Inserted Behind The Board")).toBeVisible();
});

test("announces the column count instead of a bare digit", async ({ page }) => {
  // The guard for the hidden count in BoardColumn. Written as `{count} {word}`
  // JSX emits three text nodes and the accessibility tree holds "1" and
  // "application" separately, with no node named "1 application" — and a jsdom
  // test cannot tell the two apart, because Testing Library normalises
  // whitespace across text nodes. Only a real accessibility tree can.
  await page.goto("/");
  await expect(column(page, "Applied").getByText("1 application")).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const named = (pattern: RegExp) =>
    nodes.filter((node) => !node.ignored && pattern.test(node.name?.value ?? ""));

  expect(named(/^\d+ applications?$/).length).toBeGreaterThan(0);
  expect(named(/^\d+$/)).toHaveLength(0);
});
