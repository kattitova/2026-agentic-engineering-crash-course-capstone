import { expect, test, type Page } from "@playwright/test";
import { resetBoard, withDatabase } from "./reset-board";

/** Seeded by `npm run e2e:db`: Acme Cloud sits in Applied with a posting link. */
const APPLIED = { id: "e2e-applied", company: "Acme Cloud", position: "Frontend Engineer" };
/** Seeded in Interview, and the card this spec deletes. */
const INTERVIEW = { id: "e2e-interview", company: "Globex" };

function column(page: Page, name: string) {
  return page.getByRole("region", { name });
}

function editDialog(page: Page) {
  return page.getByRole("dialog", { name: "Edit application" });
}

function confirmDialog(page: Page, company: string) {
  return page.getByRole("dialog", { name: `Delete ${company}?` });
}

async function openEdit(page: Page, company: string): Promise<void> {
  await page.getByRole("button", { name: `Edit ${company}` }).click();
  await expect(editDialog(page)).toBeVisible();
}

/** Read from the database, so "stored" is never read off the interface. */
function storedRow(id: string) {
  return withDatabase(
    (db) =>
      db
        .prepare(
          "SELECT company, position, link, notes, status, appliedDate, statusChangedAt FROM JobApplication WHERE id = ?",
        )
        .get(id) as
        | {
            company: string;
            position: string;
            link: string | null;
            notes: string | null;
            status: string;
            appliedDate: number | string | null;
            statusChangedAt: number | string;
          }
        | undefined,
  );
}

function storedCount(): number {
  return withDatabase(
    (db) => (db.prepare("SELECT COUNT(*) AS n FROM JobApplication").get() as { n: number }).n,
  );
}

test.beforeEach(() => {
  resetBoard();
});

// Leaves the database as the seeder left it, so the suite can be run again
// against the same file without a reseed — and so whatever runs next sees the
// board the seeder describes.
test.afterAll(() => {
  resetBoard();
});

test("edits an application and leaves it where it was", async ({ page }) => {
  const before = storedRow(APPLIED.id);
  await page.goto("/");

  await openEdit(page, APPLIED.company);
  // Pre-filled, so correcting one value does not mean retyping the rest.
  await expect(page.getByLabel("Company")).toHaveValue(APPLIED.company);
  await expect(page.getByLabel("Position")).toHaveValue(APPLIED.position);

  await page.getByLabel("Company").fill("Acme Cloud GmbH");
  await page.getByLabel("Notes").fill("Second interview booked");
  await editDialog(page).getByRole("button", { name: "Save changes" }).click();

  await expect(editDialog(page)).toBeHidden();
  await expect(column(page, "Applied").getByText("Acme Cloud GmbH")).toBeVisible();

  await page.reload();
  await expect(column(page, "Applied").getByText("Acme Cloud GmbH")).toBeVisible();
  // Still one card per stored application: an edit must not create a second.
  await expect(page.getByRole("article")).toHaveCount(storedCount());
  await expect(column(page, "Applied").getByText("1 application")).toBeVisible();

  const after = storedRow(APPLIED.id);
  expect(after?.company).toBe("Acme Cloud GmbH");
  expect(after?.notes).toBe("Second interview booked");
  // The three fields an edit must not touch. Compared against what was stored
  // before, which is the only way to see a clock that was quietly reset.
  expect(after?.status).toBe(before?.status);
  expect(after?.appliedDate).toEqual(before?.appliedDate);
  expect(after?.statusChangedAt).toEqual(before?.statusChangedAt);
});

test("clearing the link leaves the card with no posting link", async ({ page }) => {
  await page.goto("/");
  // The seeded row has one, so there is something to clear.
  await expect(
    column(page, "Applied").getByRole("link", { name: new RegExp(APPLIED.company) }),
  ).toBeVisible();

  await openEdit(page, APPLIED.company);
  await page.getByLabel("Link").fill("");
  await editDialog(page).getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog(page)).toBeHidden();

  await page.reload();
  await expect(
    column(page, "Applied").getByRole("link", { name: new RegExp(APPLIED.company) }),
  ).toHaveCount(0);
  // Stored as NULL, not as "": the board renders both the same way, so only the
  // database can say which it is.
  expect(storedRow(APPLIED.id)?.link).toBeNull();
});

test("refuses an edit it cannot store and keeps what was typed", async ({ page }) => {
  await page.goto("/");
  await openEdit(page, APPLIED.company);

  await page.getByLabel("Company").fill("   ");
  await page.getByLabel("Position").fill("Staff Engineer");
  await editDialog(page).getByRole("button", { name: "Save changes" }).click();

  await expect(editDialog(page)).toBeVisible();
  await expect(page.getByLabel("Company")).toHaveAttribute("aria-invalid", "true");
  await expect(editDialog(page).getByText(/company is required/i)).toBeVisible();
  // Not snapped back to the stored values: the refused values are what the
  // person is being asked to correct.
  await expect(page.getByLabel("Company")).toHaveValue("   ");
  await expect(page.getByLabel("Position")).toHaveValue("Staff Engineer");

  expect(storedRow(APPLIED.id)?.company).toBe(APPLIED.company);
  expect(storedRow(APPLIED.id)?.position).toBe(APPLIED.position);
});

test("dismissing the edit form changes nothing", async ({ page }) => {
  await page.goto("/");
  await openEdit(page, APPLIED.company);
  await page.getByLabel("Company").fill("Never saved");

  await page.keyboard.press("Escape");

  await expect(editDialog(page)).toBeHidden();
  expect(storedRow(APPLIED.id)?.company).toBe(APPLIED.company);
  await page.reload();
  await expect(page.getByText("Never saved")).toHaveCount(0);
});

test("says the application was not found when the row went while the form was open", async ({
  page,
}) => {
  // The case a review pass found broken: the not-found branch revalidates the
  // board, and while the dialog's open state was derived from the row still
  // being in the list, that revalidation closed the form and took the message
  // with it. The person saw a dialog close and a card vanish, which is exactly
  // what a save that worked looks like.
  await page.goto("/");
  await openEdit(page, APPLIED.company);
  await page.getByLabel("Company").fill("Saved into a row that is gone");

  // Deleted behind the open form, as another tab or a direct edit would.
  withDatabase((db) => {
    db.prepare("DELETE FROM JobApplication WHERE id = ?").run(APPLIED.id);
  });

  await editDialog(page).getByRole("button", { name: "Save changes" }).click();

  await expect(editDialog(page)).toBeVisible();
  await expect(editDialog(page).getByText("Application not found")).toBeVisible();
  // And the card is gone without a reload, which is the other half of it.
  await expect(page.getByText(APPLIED.company)).toHaveCount(0);

  // The dialog closes when the person closes it, and nothing was written.
  await page.keyboard.press("Escape");
  await expect(editDialog(page)).toBeHidden();
  expect(storedRow(APPLIED.id)).toBeUndefined();
});

test("deletes an application once the deletion is confirmed", async ({ page }) => {
  const total = storedCount();
  await page.goto("/");
  await expect(column(page, "Interview").getByText("1 application")).toBeVisible();

  await page.getByRole("button", { name: `Delete ${INTERVIEW.company}` }).click();
  await expect(confirmDialog(page, INTERVIEW.company)).toBeVisible();
  await confirmDialog(page, INTERVIEW.company)
    .getByRole("button", { name: "Delete application" })
    .click();

  await expect(page.getByText(INTERVIEW.company)).toHaveCount(0);
  await expect(column(page, "Interview").getByText("0 applications")).toBeVisible();

  await page.reload();
  await expect(page.getByText(INTERVIEW.company)).toHaveCount(0);
  expect(storedRow(INTERVIEW.id)).toBeUndefined();
  expect(storedCount()).toBe(total - 1);
  // The other cards are untouched, which a count alone would not show.
  await expect(column(page, "Applied").getByText(APPLIED.company)).toBeVisible();
});

test("declining the confirmation keeps the application", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: `Delete ${INTERVIEW.company}` }).click();
  await expect(confirmDialog(page, INTERVIEW.company)).toBeVisible();
  await confirmDialog(page, INTERVIEW.company).getByRole("button", { name: "Keep it" }).click();

  await expect(confirmDialog(page, INTERVIEW.company)).toBeHidden();
  await expect(column(page, "Interview").getByText(INTERVIEW.company)).toBeVisible();

  await page.reload();
  await expect(column(page, "Interview").getByText(INTERVIEW.company)).toBeVisible();
  expect(storedRow(INTERVIEW.id)).toBeDefined();
});

test("dismissing the confirmation with Escape keeps the application", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: `Delete ${INTERVIEW.company}` }).click();
  await expect(confirmDialog(page, INTERVIEW.company)).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(confirmDialog(page, INTERVIEW.company)).toBeHidden();
  expect(storedRow(INTERVIEW.id)).toBeDefined();
});

/**
 * Reports every Tab press as either inside the open dialog, outside it, or
 * parked on the body as the cycle wraps.
 *
 * `wrap` is allowed and is not a leak: Chromium parks focus on the body for one
 * step. What must never happen is focus landing on a focusable element outside
 * the dialog — a card's "Move ..." handle, or the header's add control — which
 * is what show() in place of showModal() produces.
 */
async function tabTrail(page: Page, presses: number): Promise<string[]> {
  const trail: string[] = [];
  for (let index = 0; index < presses; index += 1) {
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
  return trail;
}

test("keeps focus inside the edit form and gives it back to the card's control", async ({
  page,
}) => {
  // The focus trap and focus restoration are the native <dialog>'s, which jsdom
  // does not implement — so this is the only place either is checked.
  await page.goto("/");
  const control = page.getByRole("button", { name: `Edit ${APPLIED.company}` });

  await control.focus();
  await page.keyboard.press("Enter");
  await expect(editDialog(page)).toBeVisible();

  // Enough presses to pass every control twice, so this is about the trap and
  // not about where the count happens to land.
  const trail = await tabTrail(page, 14);
  expect(trail.filter((step) => step.startsWith("OUTSIDE"))).toEqual([]);
  // Focus really did move through the dialog, rather than sitting on `wrap` for
  // all fourteen presses and passing by never going anywhere.
  expect(new Set(trail.filter((step) => step.startsWith("in:"))).size).toBeGreaterThan(3);

  await page.keyboard.press("Escape");
  await expect(editDialog(page)).toBeHidden();
  await expect(control).toBeFocused();
});

test("keeps focus inside the confirmation and gives it back on a declined delete", async ({
  page,
}) => {
  await page.goto("/");
  const control = page.getByRole("button", { name: `Delete ${INTERVIEW.company}` });

  await control.focus();
  await page.keyboard.press("Enter");
  await expect(confirmDialog(page, INTERVIEW.company)).toBeVisible();

  // Two controls, so fewer presses are enough to go round several times.
  const trail = await tabTrail(page, 8);
  expect(trail.filter((step) => step.startsWith("OUTSIDE"))).toEqual([]);
  expect(new Set(trail.filter((step) => step.startsWith("in:"))).size).toBeGreaterThan(1);

  await page.keyboard.press("Escape");
  await expect(confirmDialog(page, INTERVIEW.company)).toBeHidden();
  await expect(control).toBeFocused();
  expect(storedRow(INTERVIEW.id)).toBeDefined();
});

test("deletes an application with the keyboard alone", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: `Delete ${INTERVIEW.company}` }).focus();
  await page.keyboard.press("Enter");
  await expect(confirmDialog(page, INTERVIEW.company)).toBeVisible();

  // Tab to the confirm control and press it, rather than clicking: the whole
  // point is that no pointer is involved.
  const confirm = confirmDialog(page, INTERVIEW.company).getByRole("button", {
    name: "Delete application",
  });
  await confirm.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByText(INTERVIEW.company)).toHaveCount(0);
  await page.reload();
  expect(storedRow(INTERVIEW.id)).toBeUndefined();
});
