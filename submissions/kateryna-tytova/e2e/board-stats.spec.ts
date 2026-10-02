import { expect, test, type Page } from "@playwright/test";
import { moveRightWithKeyboard } from "./keyboard-move";
import { resetBoard } from "./reset-board";

/**
 * Scoped to the summary's own landmark, never to the page.
 *
 * The column counts render the same phrases - "1 application", "2 applications" -
 * so a page-wide text query would match a column badge and read as the summary
 * agreeing when it had not changed at all.
 */
function summary(page: Page) {
  return page.getByRole("region", { name: "Application summary" });
}

test.beforeEach(() => {
  resetBoard();
});

// This file moves a seeded card. The suite runs one worker against one database,
// so without restoring it a later spec would open a board with two cards in
// Interview and no way to tell why.
test.afterAll(() => {
  resetBoard();
});

test("summarises the seeded board", async ({ page }) => {
  // Three applications: Wishlist, Applied, Interview. One of the three has
  // reached the interview stage, so 1 of 3 is 33%.
  await page.goto("/");

  await expect(summary(page)).toContainText("3 applications");
  await expect(summary(page)).toContainText("33% reached interview");
  // What the percentage counts, which the figure itself cannot show.
  await expect(summary(page)).toContainText("Interview or Offer");
});

test("re-measures the share as soon as a card reaches Interview", async ({ page }) => {
  await page.goto("/");
  await expect(summary(page)).toContainText("33% reached interview");

  // A real keyboard move, so what is asserted next is the optimistic list: no
  // reload happens between the drop and the assertion. Two of three reached.
  await moveRightWithKeyboard(page, "Acme Cloud", "INTERVIEW");

  await expect(summary(page)).toContainText("67% reached interview");
  await expect(summary(page)).toContainText("3 applications");
});

test("keeps the new share after a reload, because the move was stored", async ({ page }) => {
  await page.goto("/");
  await moveRightWithKeyboard(page, "Acme Cloud", "INTERVIEW");
  await expect(summary(page)).toContainText("67% reached interview");

  // The half that proves the figure follows the stored data and not only the
  // optimistic list: after a reload the server list is the only source there is.
  await page.reload();

  await expect(summary(page)).toContainText("67% reached interview");
  await expect(summary(page)).toContainText("3 applications");
});
