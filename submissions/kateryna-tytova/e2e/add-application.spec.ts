import { expect, test, type Page } from "@playwright/test";
import { resetBoard, withDatabase } from "./reset-board";

const COMPANY = "Northwind Analytics";
const POSITION = "Platform Engineer";

function column(page: Page, name: string) {
  return page.getByRole("region", { name });
}

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Add application" });
}

function trigger(page: Page) {
  return page.getByRole("button", { name: "Add application", exact: true }).first();
}

async function openDialog(page: Page): Promise<void> {
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
}

/** Counted in the database, not on screen, so "stored" is not read off the UI. */
function storedCount(company: string): number {
  return withDatabase(
    (db) =>
      (
        db
          .prepare("SELECT COUNT(*) AS n FROM JobApplication WHERE company = ?")
          .get(company) as { n: number }
      ).n,
  );
}

function storedRow(company: string): { link: string | null; notes: string | null } | undefined {
  return withDatabase(
    (db) =>
      db.prepare("SELECT link, notes FROM JobApplication WHERE company = ?").get(company) as
        | { link: string | null; notes: string | null }
        | undefined,
  );
}

test.beforeEach(() => {
  resetBoard();
});

// Leaves the database as the seeder left it, so the suite can be run again
// against the same file without a reseed.
test.afterAll(() => {
  resetBoard();
});

test("adds an application to the Wishlist column", async ({ page }) => {
  await page.goto("/");
  await expect(column(page, "Wishlist").getByText("1 application")).toBeVisible();

  await openDialog(page);
  await page.getByLabel("Company").fill(COMPANY);
  await page.getByLabel("Position").fill(POSITION);
  await dialog(page).getByRole("button", { name: "Add application" }).click();

  await expect(dialog(page)).toBeHidden();
  await expect(column(page, "Wishlist").getByText(COMPANY)).toBeVisible();
  // The count is a separate rendering path from the cards, so it is worth
  // asserting rather than assuming.
  await expect(column(page, "Wishlist").getByText("2 applications")).toBeVisible();

  // Left empty means stored as NULL, not as "". Only the database can say which,
  // and the board renders both the same way.
  expect(storedRow(COMPANY)).toEqual({ link: null, notes: null });
});

test("dismissing the form adds nothing and leaves the board alone", async ({ page }) => {
  await page.goto("/");
  await openDialog(page);
  await page.getByLabel("Company").fill(COMPANY);
  await page.getByLabel("Position").fill(POSITION);

  await page.keyboard.press("Escape");

  await expect(dialog(page)).toBeHidden();
  expect(storedCount(COMPANY)).toBe(0);
  await expect(column(page, "Wishlist").getByText("1 application")).toBeVisible();
  await expect(page.getByText(COMPANY)).toHaveCount(0);

  // Not only unstored but unshown after a reload, which is the difference
  // between a card the board is holding optimistically and no card at all.
  await page.reload();
  await expect(page.getByText(COMPANY)).toHaveCount(0);
});

test("the application is stored, not only shown", async ({ page }) => {
  await page.goto("/");
  await openDialog(page);
  await page.getByLabel("Company").fill(COMPANY);
  await page.getByLabel("Position").fill(POSITION);
  await dialog(page).getByRole("button", { name: "Add application" }).click();
  await expect(column(page, "Wishlist").getByText(COMPANY)).toBeVisible();

  await page.reload();

  await expect(column(page, "Wishlist").getByText(COMPANY)).toBeVisible();
});

test("refuses an application it cannot store and keeps what was typed", async ({ page }) => {
  await page.goto("/");
  await openDialog(page);
  await page.getByLabel("Position").fill(POSITION);

  // Left empty: the browser's own required check stops the submission before
  // the action runs, which is still "nothing is stored and nothing is lost".
  await dialog(page).getByRole("button", { name: "Add application" }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByLabel("Position")).toHaveValue(POSITION);

  // Spaces satisfy `required`, so this is the path that reaches the validator
  // and has to come back with a message naming the company field.
  await page.getByLabel("Company").fill("   ");
  await dialog(page).getByRole("button", { name: "Add application" }).click();

  const company = page.getByLabel("Company");
  await expect(company).toHaveAttribute("aria-invalid", "true");
  await expect(dialog(page).getByText(/company is required/i)).toBeVisible();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByLabel("Position")).toHaveValue(POSITION);

  expect(storedCount("   ")).toBe(0);
  expect(storedCount("")).toBe(0);

  await page.reload();
  await expect(column(page, "Wishlist").getByText(POSITION)).toHaveCount(0);
  await expect(column(page, "Wishlist").getByText("1 application")).toBeVisible();
});

test("stores a note's line breaks as it received them", async ({ page }) => {
  // Open question from the 2026-09-29 review: a textarea serialises line breaks
  // as CRLF in a classic form submission, which would make a note count one
  // character more per break than the textarea's own maxLength allows, and
  // would store a carriage return. This is the measurement that answers it.
  await page.goto("/");
  await openDialog(page);
  await page.getByLabel("Company").fill(COMPANY);
  await page.getByLabel("Position").fill(POSITION);
  await page.getByLabel("Notes").fill("first\nsecond");
  await dialog(page).getByRole("button", { name: "Add application" }).click();
  await expect(dialog(page)).toBeHidden();

  expect(storedRow(COMPANY)?.notes).toBe("first\nsecond");
});

test("keeps focus inside the dialog and gives it back on Escape", async ({ page }) => {
  await page.goto("/");

  await trigger(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();

  // Tabbing past the last control must not reach the board behind the dialog.
  // Enough presses to pass every control twice, so this is about the trap and
  // not about where the count happens to land.
  //
  // `body` is allowed and is not a leak: Chromium parks focus there for one
  // step as the cycle wraps round. What must never happen is focus landing on a
  // focusable element outside the dialog - the trigger, or one of the board's
  // "Move ..." handles - which is exactly what show() in place of showModal()
  // produces, and what this assertion is here to catch.
  const trail: string[] = [];
  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press("Tab");
    trail.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body || active === document.documentElement) {
          return "wrap";
        }
        const inDialog = document.querySelector("dialog[open]")?.contains(active);
        const label =
          active.getAttribute("name") ??
          active.getAttribute("aria-label") ??
          active.textContent?.trim().slice(0, 30) ??
          active.tagName.toLowerCase();
        return `${inDialog ? "in" : "OUTSIDE"}:${label}`;
      }),
    );
  }
  expect(trail.filter((step) => step.startsWith("OUTSIDE"))).toEqual([]);
  // Focus really did move through the dialog, rather than sitting on `wrap`
  // for all fourteen presses and passing the check by never going anywhere.
  expect(new Set(trail.filter((step) => step.startsWith("in:"))).size).toBeGreaterThan(3);

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
});
