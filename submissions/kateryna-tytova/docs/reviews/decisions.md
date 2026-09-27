# Review decisions ledger

**This file belongs to the author, not the reviewer.** The reviewer sub-agent
(`.claude/agents/reviewer.md`) is required to read it and is forbidden to edit it or to re-raise
anything listed here as Accepted, Deferred or Declined. It is what stops the
fix → review → fix loop: a decision recorded here is closed.

## How to use it

- After each review, add a row for every finding you do not simply fix.
- `Accepted` — the finding is valid and the code now does what it asked. Closed.
- `Deferred (<change>)` — valid, but belongs to a later change. Closed **until that change is
  under review**, at which point the reviewer may cash the deferral in once, at the severity
  named here.
- `Declined` — the finding will not be acted on. Closed permanently. The reviewer gets one
  sentence of objection under "Open questions" and may not raise it a third time.
- Findings from 2026-09-27 onward carry reviewer-issued IDs (`R<YYYYMMDD>-<n>`). The two earlier
  reviews predate IDs, so they are referenced by their section, as the disposition notes in
  `review-log.md` do.

## Closed — Deferred

| Finding | Severity | Deferred to | Reason |
| --- | --- | --- | --- |
| 2026-09-21 §3/§5 — no maximum field lengths on `company`, `position`, `link`, `notes` | Major | `add-application` | The form is where `maxLength` belongs and where validation first meets a user. No gap open today: `createApplication` and `updateApplication` have no caller, so the only write paths are `prisma/seed.ts` and the tests. The layout half of the finding was **not** deferred — it is fixed. |
| 2026-09-21 §3 — concurrent-drag rule (two fast drags of the same card) | Note | `add-drag-and-drop` | A design decision for that change, not a defect in shipped code. |
| 2026-09-21 §6 — `KeyboardSensor` not wired | Note | `add-drag-and-drop` | Same: the interaction does not exist yet. |
| 2026-09-27 §3 — what a `NOT_FOUND` failure should do to the board mid-move | Note | `add-drag-and-drop` | Belongs to the change that introduces the move. |
| 2026-09-27 §3 — dnd-kit's default arrow-key step (25px) will not reach the next column | Note | `add-drag-and-drop` | Needs a custom `coordinateGetter`; a design item for that change. |
| 2026-09-21 §2 — commit the proposal before implementation | Minor | `add-drag-and-drop` | Applies to that change's history, not to work already done. |
| 2026-09-27 §4 — "read per request, not per build" has no automated guard | Major | `add-drag-and-drop` | The behavioural check is "a row inserted directly into the database appears on reload", which is an e2e check and lands with the Playwright suite. A source-inspecting unit test would pass against a misplaced call; a build-output assertion would put `next build` inside `npm run verify`. Both rejected with reasons in the change's design. Until then the requirement rests on a recorded manual check. |

## Closed — Declined

| Finding | Severity | Reason |
| --- | --- | --- |
| 2026-09-21 §1 — unused `@playwright/test` and `@dnd-kit` packages | Note | They are the dependencies of `add-drag-and-drop`, which is already proposed. Removing and reinstalling would churn the lockfile for no behavioural gain, and `@playwright/test` earned its keep by measuring the layout fix in `harden-kanban-board`. |
| 2026-09-21 §1 / Open question 1 — disabled "Add application" button has no requirement behind it | Minor | Kept for design fidelity, recorded in the `spec.md` Spec change log — the route `AGENTS.md` prescribes for scope beyond the spec. Becomes a working control in `add-application`. |
| 2026-09-21 §7 / Open question 3 — `listApplications` outside the `ActionResult` convention | Note | Resolved by scoping the convention rather than changing the shape: the read moved to `lib/applications/queries.ts` and keeps throwing, caught by the error boundary. Server actions return `ActionResult`; data loaders throw. Restated in `spec.md`. |

## Closed — Accepted (fixed)

Recorded for completeness; the reviewer must not re-raise these either, but a re-review may
verify that the fix is effective (see hard rule 6 in the agent definition).

| Finding | Severity | Fixed in |
| --- | --- | --- |
| 2026-09-21 §3 — crash on a status outside the enum | Major | `harden-kanban-board` |
| 2026-09-21 §3/§5 — long values distort the board (layout half) | Major | `harden-kanban-board` |
| 2026-09-21 §4 — no test covers the rendering requirements | Major | `harden-kanban-board` |
| 2026-09-21 §4 — weak `dotClass` assertion | Minor | `harden-kanban-board` |
| 2026-09-21 §5 — `href` rendered without a second scheme check | Minor | `harden-kanban-board` |
| 2026-09-21 §6 — identical link accessible names across cards | Minor | `harden-kanban-board` |
| 2026-09-21 §1 — column order stated unconditionally in the spec | Note | `harden-kanban-board` |
| 2026-09-27 §6/§4 — count `aria-label` on a name-prohibited `generic` role, test asserts the attribute | Major | `harden-kanban-board` |
| 2026-09-27 §2 — the change was entirely uncommitted | Minor | `harden-kanban-board` |
| 2026-09-27 §2/§4 — `@testing-library/jest-dom` installed but unused; `toBeDefined()` where intent matters | Minor | `harden-kanban-board` |
| 2026-09-27 §7 — non-null assertion in `BoardColumn.test.tsx` | Minor | `harden-kanban-board` |
| 2026-09-27 §6 — unnamed card `<article>`, unlabelled column `<section>`, new tab not announced | Minor | `harden-kanban-board` |

## Open — not yet decided

None. Every finding from the 2026-09-27 review is closed above.

Two notes the author is carrying forward rather than closing silently, both recorded in
`docs/review-log.md`:

- The §6 fix was verified in a real accessibility tree (Chrome via CDP), not argued about. The
  review's stated mechanism — that Chrome drops a name from a `generic` role — did not reproduce;
  Chrome exposed it. The fix was made anyway, because ARIA prohibits naming `generic` and the bare
  digit stayed in the tree beside it.
- The jsdom test written for that requirement **cannot distinguish the working fix from the broken
  one**: Testing Library normalises whitespace across text nodes, and the failure mode was JSX
  emitting three text nodes instead of one. The browser probe is the evidence. This is the same
  class as the deferred §4 guard above and lands with the same Playwright suite.
