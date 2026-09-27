# 2026-09-27 — harden-kanban-board (re-review) + add-drag-and-drop plan items

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** re-review (follow-up to `docs/reviews/2026-09-27-harden-kanban-board.md`)
**Reviewed:** the commits that landed the previously-reviewed working tree and the fixes on top of
it — `54d0bfd`, `aa3bf40`, `f52b1c8`, `3f5485e`, `5be089d`, `3dfc8d9` — plus the current state of
`components/board/{ApplicationCard,BoardColumn}.tsx` and their test files,
`lib/applications/{validation.ts,queries.ts}`, `vitest.config.mts`,
`openspec/changes/harden-kanban-board/tasks.md` and
`openspec/changes/add-drag-and-drop/{tasks.md,specs/kanban-board/spec.md,design.md}`. The only
uncommitted files are `.agent-log/actions.jsonl`, `docs/review-log.md` and the four review
documents under `docs/reviews/` — no source file is uncommitted.
**Verification run:** `npm run verify` — lint, typecheck and 45 tests in 5 files pass (2.15s).
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 2 minor (both carried forward unchanged from
the previous pass; no new findings, as the re-review scope forbids them).

## Finding IDs assigned retroactively

The previous two passes predate the `R<YYYYMMDD>-<n>` convention. The blocking items of the
2026-09-27 pass, and the two Minor items that are still open, now carry the stable IDs below.
They are the IDs those findings keep forever; nothing is renumbered from here on. The mapping is
to the numbering used in the hand-off that requested this re-review and in
`docs/reviews/2026-09-27-harden-kanban-board.md`.

| New ID | Previous reference | Severity then |
| --- | --- | --- |
| `R20260927-1` | item 1 — count `aria-label` on a name-prohibited `generic` role, and its attribute-only test (§6/§4) | Major |
| `R20260927-2` | item 2 — "read per request, not at build time" has no automated guard (§4) | Major |
| `R20260927-3` | item 3 — dnd-kit's default keyboard `coordinateGetter` moves 25px per arrow key (§3, against the `add-drag-and-drop` plan) | Major |
| `R20260927-4` | item 4 — concurrent/overlapping `updateApplicationStatus` writes from two quick drags (§3, against the plan) | Major |
| `R20260927-5` | item 5 — `NOT_FOUND` returned before `revalidatePath` (§3) | Note |
| `R20260927-6` | §4 Minor — clamp/wrap assertions check class substrings only | Minor |
| `R20260927-7` | §2 Minor — red-then-green order is unverifiable from history | Minor |

## Previously decided — not re-raised

Read from `docs/reviews/decisions.md` and deliberately left alone. This table is not a findings
list and does not affect the verdict.

| Closed item | Status in the ledger |
| --- | --- |
| No maximum field lengths on `company`, `position`, `link`, `notes` | Deferred (`add-application`) — that change is not under review, so the deferral is not cashed here |
| Unused `@playwright/test` / `@dnd-kit` packages | Declined |
| Disabled "Add application" button without a requirement | Declined |
| `listApplications` outside the `ActionResult` convention | Declined (convention scoped instead: actions return, loaders throw) |
| Crash on a status outside the enum; long-value layout; missing rendering tests; weak `dotClass` assertion; `href` without a second scheme check; identical link names; unconditional column-order wording | Accepted (fixed) |
| `@testing-library/jest-dom` unused; `toBeDefined()` pattern; non-null assertion in a test; unnamed `<article>`; unlabelled `<section>`; new tab not announced; change entirely uncommitted | Accepted (fixed) |
| The jsdom test for the count cannot distinguish the working fix from the broken one | Carried by the author, deferred to the Playwright suite (task 4.2b) |

## Status of previous findings

- **`R20260927-1` — fixed (fix verified effective at the level jsdom allows).**
  `components/board/BoardColumn.tsx:28-36` no longer labels the badge. The visible digit is
  `aria-hidden="true"` (line 32) and the announced text is a single template literal in an
  `sr-only` span (line 35), so the accessibility tree carries one node named "3 applications" and
  no bare digit. `sr-only` is a real Tailwind v4 utility and `app/globals.css:1` imports
  Tailwind, so the text is hidden visually rather than removed. The test moved off the attribute:
  `BoardColumn.test.tsx:45` asserts the rendered text and `:47` asserts the digit is hidden, and
  `:59` pins the singular. The one dimension the jsdom test still cannot see — three text nodes
  versus one — is recorded by the author in `decisions.md` and deferred to e2e task 4.2b, so it is
  closed and not re-raised. This is not "a guard on the wrong element": the element that carries
  the name is the one whose text is read.
- **`R20260927-2` — not fixed, closed by decision (Deferred).** `lib/applications/queries.ts`
  still relies on `await connection()` with no automated guard; removing it keeps `npm run verify`
  green. The ledger records this as Deferred to `add-drag-and-drop`, with the rejected
  alternatives argued in that change's design, and
  `openspec/changes/add-drag-and-drop/tasks.md:4.2a` now names the concrete check ("a row inserted
  directly into the e2e database appears on reload… verify it fails when `await connection()` is
  removed"). It is therefore closed for this review and will be cashable at Major when
  `add-drag-and-drop` is reviewed as implemented code.
- **`R20260927-3` — addressed in the plan.** `tasks.md:2.1a` requires a custom `coordinateGetter`
  that maps Left/Right to the adjacent `BOARD_COLUMNS` entry and ignores Up/Down, and states the
  verification ("**one** arrow press carries a picked-up card over the neighbouring column") with
  the measured 25px/259px reason. The delta spec gained a matching scenario, "One key press moves
  one column", which binds the behaviour to the requirement rather than to the task list. Nothing
  is implemented yet, so the plan is all that can be checked.
- **`R20260927-4` — addressed in the plan.** `tasks.md:2.5a` picks the "gate the handle" option:
  the card with an outstanding write has its handle disabled, other cards stay draggable, and the
  task requires verifying re-enable on both success and failure. Two spec scenarios were added —
  "A card cannot be moved again while its move is being stored" and "Other cards stay movable" —
  so the ordering rule is now a requirement, not a design aside. This is the answer the previous
  two passes asked for.
- **`R20260927-5` — addressed in the plan.** `tasks.md:2.6a` requires revalidating on the
  `NOT_FOUND` branch and verifying that no card is left behind without a reload, and the
  "A failed move…" requirement was rewritten so that an application that no longer exists is
  explicitly *not* restored, with its own scenario. The wording change is the substantive part:
  the old requirement would have been violated by the correct behaviour.

## Regressions introduced by the fixes

None found.

- The count fix touches only the badge. The column's accessible name still computes to the plain
  label ("Applied"), because the status dot is `aria-hidden` inside the `<h2>` referenced by
  `aria-labelledby`; `BoardColumn.test.tsx:53` pins that exact name, so a leak of the dot or the
  count into the region name would fail.
- Naming the card did not break the link's Label-in-Name position: the visible "View posting"
  remains a substring of the accessible name `View posting at <company> (opens in a new tab)`
  (`ApplicationCard.tsx:39`), asserted at `ApplicationCard.test.tsx:48,93`.
- The `aria-labelledby` ids are derived from `application.id` and `column.status`
  (`ApplicationCard.tsx:10`, `BoardColumn.tsx:11`), so they stay unique across a board with
  several cards and five columns; no duplicate-id collision is reachable from the render path.
- `f52b1c8` changed `lib/applications/validation.ts` only by exporting the existing `isHttpUrl`
  with a comment. The predicate body is untouched, so both write paths keep the same guard and the
  render path shares it rather than duplicating it.
- `npm run verify` passes; `grep` finds no `any` in `app/`, `lib/` or `components/` outside the
  generated Prisma client; all 37 tasks in `harden-kanban-board/tasks.md` are checked and the code
  for each is now committed, in typed commits (`fix(board): …`, `test(board): …`,
  `docs(openspec): …`) that follow the `type(scope): description` rule.

## New Critical or Major defects inside the fix diff

None.

## Open questions

None — the re-review scope does not admit new ones, and the four open questions of the previous
pass are all answered in `docs/reviews/2026-09-27-harden-kanban-board-disposition.md`.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions — shipping does not depend on any of these

Carried forward unchanged from the previous pass; not restated as new findings and not required.

- **[Minor]** `R20260927-6` `components/board/ApplicationCard.test.tsx:57-60` — the wrap/clamp
  assertions still check that the class strings contain `break-words` and `line-clamp-`, so
  `line-clamp-3` → `line-clamp-1` passes. Acknowledged in the test itself; the real check is the
  measured Chromium observation in task 4.6.
- **[Minor]** `R20260927-7` — the red-then-green order claimed by tasks 1.1, 1.3 and 4.x cannot be
  read out of history, because the change was committed as file groups after the fact. The author
  states this plainly in the disposition rather than implying otherwise, which is the right
  handling; it remains true.
