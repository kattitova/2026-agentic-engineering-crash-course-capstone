# 2026-09-27 — disposition of the second review pass (`harden-kanban-board`)

Written by the author. The change was still uncommitted and unarchived when the review ran, so
these findings were folded into the change itself rather than into a new one — which is the
difference from 2026-09-21, when the reviewed feature had already been archived.

## Resolved in `harden-kanban-board`

| Finding | Resolution | Evidence |
| --- | --- | --- |
| §6/§4 [Major] count label on a name-prohibited `generic` | visually hidden text; the digit is `aria-hidden` | Chrome accessibility tree via CDP: `StaticText "1 application"`, bare digit no longer present |
| §2/§4 [Minor] `@testing-library/jest-dom` installed and unused | imported in both component test files; `toBeDefined()` replaced by `toBeInTheDocument`, `toHaveAttribute`, `toHaveAccessibleName` | 45 tests pass |
| §7 [Minor] non-null assertion in a test | destructuring instead of `find(…)!` | no `!` assertion left in the project's own source |
| §6 [Minor] unnamed card `<article>` | `aria-labelledby` pointing at the company heading | tree lists one named article per card |
| §6 [Minor] unnamed column `<section>` | `aria-labelledby` pointing at the column heading | tree lists five named regions |
| §6 [Minor] new tab not announced | accessible name says "(opens in a new tab)" | `toHaveAccessibleName(/opens in a new tab/i)` |

## Corrections to the review

- **§6 overstates the browser behaviour.** It says Chrome and Firefox drop a name from a `generic`
  role. Chrome does not: the probe returned `role=generic name="1 application" ignored=false`. The
  recommendation was still followed, because ARIA specifies `generic` as name-prohibited and a name
  there is not something to depend on — but the finding's stated mechanism did not reproduce.
- **A defect the review could not have seen, found while fixing it.** Written as
  `{count} {word}`, JSX emits three text nodes, and the accessibility tree then holds "1" and
  "application" separately with no node named "1 application". The hidden text has to be one
  template literal. Testing Library normalises whitespace across text nodes, so the jsdom test
  passes either way: **the test added for this requirement cannot distinguish the working fix from
  the broken one.** The browser probe is the real evidence, and that limit is recorded here rather
  than hidden behind a green suite.

## Accepted and acted on

- **§4 [Major] the per-request-render requirement has no automated guard.** Accepted. Deferred to
  the Playwright suite in `add-drag-and-drop`, as a check that a row inserted directly into the
  database appears on reload. A source-inspecting unit test and a build-output assertion in
  `npm run verify` were both considered and rejected, with reasons in the change's design. Until the
  suite exists, the requirement rests on a recorded manual check — stated plainly rather than
  implied.
- **§2 [Minor] nothing committed.** Acted on: the change is being committed as logical groups of
  files. This does not manufacture the red-then-green history that `tasks.md` describes — that
  cannot be reconstructed after the fact, and pretending otherwise would be worse than saying so.
  The commits give granularity, not TDD evidence.

## Carried to `add-drag-and-drop`, not fixed here

- **[Major] the concurrent-drag rule**, unanswered across two review passes.
- **[Major] dnd-kit's default arrow key moves 25px.** Verified independently at
  `node_modules/@dnd-kit/core/dist/core.cjs.development.js:1114-1131`. Columns measure 259px at
  1440px viewport, so the planned "Space, Arrow, Space" keyboard path needs a custom
  `coordinateGetter` or it cannot reach the next column at all.
- **[Note] `NOT_FOUND` does not revalidate**, so a card deleted mid-move returns to a column it no
  longer belongs to and stays until reload.

## Carried to `add-application`

- **Unbounded field lengths**, the last unresolved Major from 2026-09-21, as a blocking item.
