import { expect, test, type Locator, type Page } from "@playwright/test";
import { moveRightWithKeyboard, waitForBoardReady } from "./keyboard-move";
import { resetBoard, withDatabase } from "./reset-board";
import { tabTrail } from "./tab-trail";

/** Seeded by `npm run e2e:db`: Acme Cloud sits in Applied, Globex in Interview. */
const APPLIED = { id: "e2e-applied", company: "Acme Cloud" };
const INTERVIEW = { id: "e2e-interview", company: "Globex" };

const REFUSE_TRIGGER = "refuse_status_change";

function column(page: Page, name: string) {
  return page.getByRole("region", { name });
}

function handle(page: Page, company: string) {
  return page.getByRole("button", { name: `Move ${company}` });
}

function chooser(page: Page, company: string) {
  return page.getByRole("dialog", { name: `Move ${company} to…` });
}

/**
 * The board's own failure region. Scoped to <main>: Next renders a second
 * role="alert", its route announcer, so an unscoped query is a strict-mode error.
 */
function boardAlert(page: Page) {
  return page.getByRole("main").getByRole("alert");
}

/** Read from the database, so "stored" is never read off the interface. */
function storedStatus(id: string): string | undefined {
  return withDatabase(
    (db) =>
      (db.prepare("SELECT status FROM JobApplication WHERE id = ?").get(id) as
        | { status: string }
        | undefined)?.status,
  );
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error("the element has no box on screen");
  }
  return box;
}

async function openBoard(page: Page): Promise<void> {
  await page.goto("/");
  await waitForBoardReady(page);
}

test.beforeEach(() => {
  resetBoard();
  // A spec below installs this and removes it in a finally. If a run was killed
  // between the two, the next one must not inherit a database that refuses every
  // status write - resetBoard restores rows, not triggers.
  withDatabase((db) => db.exec(`DROP TRIGGER IF EXISTS ${REFUSE_TRIGGER}`));
});

test("moves a card by tapping its handle and choosing a column", async ({ page }) => {
  await openBoard(page);

  await handle(page, APPLIED.company).click();
  await expect(chooser(page, APPLIED.company)).toBeVisible();
  await chooser(page, APPLIED.company).getByRole("button", { name: "Interview" }).click();

  await expect(chooser(page, APPLIED.company)).toBeHidden();
  await expect(column(page, "Interview").getByText(APPLIED.company)).toBeVisible();
  await expect(column(page, "Applied").getByText(APPLIED.company)).toHaveCount(0);

  // The write is asynchronous, so poll rather than read once.
  await expect.poll(() => storedStatus(APPLIED.id)).toBe("INTERVIEW");

  await page.reload();
  await expect(column(page, "Interview").getByText(APPLIED.company)).toBeVisible();
});

test("leaves focus on the moved card's handle after a move from the chooser", async ({ page }) => {
  // Completing a move disables the handle and then remounts the card under
  // another column, so without restoring focus the person lands on the document
  // body. Playwright retries toBeFocused, which is what lets this wait for the
  // write to settle: focus is restored only once the card is no longer busy.
  await openBoard(page);

  await handle(page, APPLIED.company).click();
  await chooser(page, APPLIED.company).getByRole("button", { name: "Interview" }).click();

  await expect(column(page, "Interview").getByText(APPLIED.company)).toBeVisible();
  await expect(handle(page, APPLIED.company)).toBeFocused();
});

test("moves a card by dragging its handle with a pointer", async ({ page }) => {
  // The first pointer drag in the suite: every other move here goes through the
  // keyboard, and the keyboard sensor takes no activation distance - so a mouse
  // drag broken by the distance on the pointer sensor would pass everything else.
  await openBoard(page);

  const grip = await boxOf(handle(page, APPLIED.company));
  const target = await boxOf(column(page, "Interview"));
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Past the 5px threshold first, then across: a real pointer crosses it on the
  // way, it does not teleport.
  await page.mouse.move(from.x + 12, from.y + 4, { steps: 3 });
  await page.mouse.move(target.x + target.width * 0.75, target.y + 80, { steps: 20 });
  await page.mouse.up();

  await expect(column(page, "Interview").getByText(APPLIED.company)).toBeVisible();
  await expect(column(page, "Applied").getByText(APPLIED.company)).toHaveCount(0);
  // Pressed and moved is a drag, and a drag does not open the chooser.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect.poll(() => storedStatus(APPLIED.id)).toBe("INTERVIEW");
  await page.reload();
  await expect(column(page, "Interview").getByText(APPLIED.company)).toBeVisible();
});

test("opens the chooser for a click that drifts a pixel or two", async ({ page }) => {
  // A drag of a few pixels never reaches another column, so it can only have been
  // a click that wandered - which is what a trackpad or an unsteady hand produces.
  await openBoard(page);

  const grip = await boxOf(handle(page, APPLIED.company));
  const x = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 2, y + 1);
  await page.mouse.up();

  await expect(chooser(page, APPLIED.company)).toBeVisible();
  expect(storedStatus(APPLIED.id)).toBe("APPLIED");
});

test("traps focus in the chooser, keeps the board behind it out of reach, and closes on Escape", async ({
  page,
}) => {
  // The browser's own showModal() behaviour, which jsdom does not implement - so
  // this is the only place any of it is checked, and the test that fails if the
  // dialog is ever opened with show() in place of showModal().
  await openBoard(page);

  await handle(page, APPLIED.company).click();
  await expect(chooser(page, APPLIED.company)).toBeVisible();

  // Four choices and Cancel: enough presses to pass every control twice.
  const trail = await tabTrail(page, 10);
  expect(trail.filter((step) => step.startsWith("OUTSIDE"))).toEqual([]);
  expect(new Set(trail.filter((step) => step.startsWith("in:"))).size).toBeGreaterThan(3);

  // A pointer cannot reach another card either: the backdrop sits over it. A
  // trial click runs every actionability check, including that nothing else
  // receives the event, without clicking.
  await expect(
    handle(page, INTERVIEW.company).click({ trial: true, timeout: 1500 }),
  ).rejects.toThrow();

  await page.keyboard.press("Escape");
  await expect(chooser(page, APPLIED.company)).toBeHidden();
  await expect(column(page, "Applied").getByText(APPLIED.company)).toBeVisible();
  expect(storedStatus(APPLIED.id)).toBe("APPLIED");
});

test("gives focus back to the card's handle when the chooser is dismissed with Escape", async ({
  page,
}) => {
  await openBoard(page);
  const grip = handle(page, APPLIED.company);

  await grip.click();
  await expect(chooser(page, APPLIED.company)).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(chooser(page, APPLIED.company)).toBeHidden();
  await expect(grip).toBeFocused();
  expect(storedStatus(APPLIED.id)).toBe("APPLIED");
});

test("gives focus back to the card's handle when the chooser is cancelled", async ({ page }) => {
  await openBoard(page);
  const grip = handle(page, APPLIED.company);

  await grip.click();
  await chooser(page, APPLIED.company).getByRole("button", { name: "Cancel" }).click();

  await expect(chooser(page, APPLIED.company)).toBeHidden();
  await expect(grip).toBeFocused();
  // Dismissing is not a failure, and says nothing.
  await expect(boardAlert(page)).toBeEmpty();
});

test("puts the card back and says so when a move from the chooser fails to save", async ({
  page,
}) => {
  // The test that fails if the chooser's handler ever writes straight to the
  // server action instead of going through moveCard. Such a handler would still
  // call the action once with the right status, and would then neither put the
  // card back nor say anything: both come from moveCard, shared with a drop.
  //
  // The failure is a real one. A trigger makes SQLite refuse the status update, so
  // the action's own catch-all produces the message the person reads.
  withDatabase((db) =>
    db.exec(
      `CREATE TRIGGER ${REFUSE_TRIGGER} BEFORE UPDATE OF status ON JobApplication
       BEGIN SELECT RAISE(ABORT, 'refused by the e2e spec'); END`,
    ),
  );

  try {
    await openBoard(page);

    await handle(page, APPLIED.company).click();
    await chooser(page, APPLIED.company).getByRole("button", { name: "Interview" }).click();

    await expect(boardAlert(page)).toContainText(/move was not saved/i);
    await expect(column(page, "Applied").getByText(APPLIED.company)).toBeVisible();
    await expect(column(page, "Interview").getByText(APPLIED.company)).toHaveCount(0);
    expect(storedStatus(APPLIED.id)).toBe("APPLIED");

    // Released, not held for good: a failure must leave the card movable.
    await expect(handle(page, APPLIED.company)).toBeEnabled();
  } finally {
    withDatabase((db) => db.exec(`DROP TRIGGER IF EXISTS ${REFUSE_TRIGGER}`));
  }
});

test("a keyboard move does not open the chooser", async ({ page }) => {
  // Space and Enter start a keyboard move and Space's click arrives on keyup, so
  // the drop is the half that could have opened the chooser the moment a move
  // finished. dnd-kit calls preventDefault() on both the pick-up and the drop;
  // this is what would notice if an engine disagreed - Chromium only, here.
  await openBoard(page);

  await moveRightWithKeyboard(page, APPLIED.company, "INTERVIEW");

  await expect(column(page, "Interview").getByText(APPLIED.company)).toBeVisible();
  // Focus is restored once the write settles, which is long after the key came up.
  await expect(handle(page, APPLIED.company)).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
