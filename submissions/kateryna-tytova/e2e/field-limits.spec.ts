import { expect, test, type Page } from "@playwright/test";
import { resetBoard } from "./reset-board";

/**
 * The form's `maxLength` attributes, in a real browser. They cannot be tested
 * in jsdom: the component tests drive fields with `fireEvent.change`, which
 * assigns `value` directly, and a direct assignment is the one way measured to
 * bypass `maxLength`. `ApplicationForm.test.tsx` asserts the attributes are
 * wired to APPLICATION_LIMITS; this file asserts the browser acts on them.
 *
 * Company, at 120, rather than the link at 512 - the behaviour is the same and
 * this is a quarter of the keystrokes.
 */
const LIMIT = 120;
const OVER = "A".repeat(LIMIT + 10);

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Add application" });
}

async function openDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add application", exact: true }).first().click();
  await expect(dialog(page)).toBeVisible();
}

/**
 * The stop is required to be silent: no counter, and no message. Without this
 * the requirement's second clause would hold by nobody having added one yet.
 */
async function nothingIsAnnounced(page: Page): Promise<void> {
  await expect(dialog(page).getByRole("alert")).toHaveCount(0);
  // The wording the length refusal uses, so a message about the maximum
  // appearing as you type would be caught.
  await expect(dialog(page).getByText(/characters/i)).toHaveCount(0);
  // A counter in any of its usual shapes: "118/120", "2 left", "2 remaining".
  await expect(dialog(page).getByText(/\d+\s*\/\s*\d+|\d+\s+(left|remaining)/i)).toHaveCount(0);
}

test.beforeEach(() => {
  resetBoard();
});

test("typing past a field's maximum stops at the maximum, silently", async ({ page }) => {
  await page.goto("/");
  await openDialog(page);

  const company = page.getByLabel("Company");
  // Keystroke by keystroke, which is what the person does. `fill()` would also
  // respect the limit - measured - but it would not model typing.
  await company.pressSequentially(OVER);

  await expect(company).toHaveValue("A".repeat(LIMIT));
  await nothingIsAnnounced(page);
});

test("pasting past a field's maximum stops at the maximum, silently", async ({ page }) => {
  await page.goto("/");
  await openDialog(page);

  const company = page.getByLabel("Company");
  await company.focus();
  // One insertion of a whole string, which is the part of a paste that matters
  // here. A literal Ctrl+V needs clipboard permissions and adds nothing this
  // assertion can see.
  await page.keyboard.insertText(OVER);

  await expect(company).toHaveValue("A".repeat(LIMIT));
  await nothingIsAnnounced(page);
});
