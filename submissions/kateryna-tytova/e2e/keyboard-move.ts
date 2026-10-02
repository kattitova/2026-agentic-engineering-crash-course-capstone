import { expect, type Page } from "@playwright/test";

/**
 * Waits until the board can actually be driven.
 *
 * dnd-kit renders its live region into the body only on the client, so it is
 * absent from the server HTML and appearing is exactly "React has hydrated and
 * the sensors are listening". Without this the first test presses keys against
 * markup that is still inert, and the drag never starts.
 */
export async function waitForBoardReady(page: Page): Promise<void> {
  await page.locator("[id^=DndLiveRegion]").waitFor({ state: "attached" });
}

/**
 * Picks the card up and waits until dnd-kit has a keydown listener attached.
 *
 * dnd-kit attaches that listener inside a setTimeout
 * (@dnd-kit/core/dist/core.cjs.development.js:1163), so for one macrotask the
 * drag is already active - announced, aria-pressed - while no listener exists
 * and an arrow key is silently dropped. Observed as a 3-in-15 flake in which
 * the coordinate getter was never called at all. Yielding one macrotask here is
 * ordered after theirs, because theirs was queued first.
 */
async function pickUp(page: Page, company: string) {
  await waitForBoardReady(page);
  const announcements = page.locator("[id^=DndLiveRegion]");

  await page.getByRole("button", { name: `Move ${company}` }).focus();
  await page.keyboard.press("Space");
  await expect(announcements).toContainText(/moved over droppable area/i);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));

  return announcements;
}

/**
 * Moves the focused card one column to the right with the keyboard alone.
 *
 * Each step waits for dnd-kit to announce it rather than for a fixed delay.
 * Pressing the three keys back to back races the sensor and the drag silently
 * never starts; the announcements are the sensor telling us it is ready for the
 * next one, so they are both the synchronisation and the assertion that the
 * keyboard path really went through pick up -> choose column -> drop.
 *
 * Shared by every spec that needs a keyboard move rather than copied into each:
 * the waits above were each paid for by a flake, and a second copy is one that
 * can drift back to the version without them.
 */
export async function moveRightWithKeyboard(
  page: Page,
  company: string,
  targetStatus: string,
): Promise<void> {
  const announcements = await pickUp(page, company);

  await page.keyboard.press("ArrowRight");
  await expect(announcements).toContainText(
    new RegExp(`moved over droppable area ${targetStatus}`, "i"),
  );

  await page.keyboard.press("Space");
  await expect(announcements).toContainText(/was dropped over/i);
}

/**
 * Picks a card up and puts it straight back down, without choosing a column.
 *
 * `planCardMove` returns null for a drop on the card's own column, so no write
 * is made - which is what makes this the observable form of "the clock was not
 * reset by a misjudged drag".
 */
export async function pickUpAndDropInPlace(page: Page, company: string): Promise<void> {
  const announcements = await pickUp(page, company);

  await page.keyboard.press("Space");
  await expect(announcements).toContainText(/was dropped over/i);
}
