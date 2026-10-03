import type { Page } from "@playwright/test";

/**
 * Shared by every spec that checks a modal dialog traps focus, rather than copied
 * into each: a copy is one that can drift to a version that stops noticing a leak.
 *
 * Reports every Tab press as either inside the open dialog, outside it, or
 * parked on the body as the cycle wraps.
 *
 * `wrap` is allowed and is not a leak: Chromium parks focus on the body for one
 * step. What must never happen is focus landing on a focusable element outside
 * the dialog — a card's "Move ..." handle, or the header's add control — which
 * is what show() in place of showModal() produces.
 */
export async function tabTrail(page: Page, presses: number): Promise<string[]> {
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
