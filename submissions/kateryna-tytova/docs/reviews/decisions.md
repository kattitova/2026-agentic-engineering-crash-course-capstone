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
| 2026-09-21 §3 — concurrent-drag rule (two fast drags of the same card) | Note | `add-drag-and-drop` | **Cashed in 2026-09-27**: decided in that change's design — a card with a write in flight has its handle disabled; other cards stay draggable. Closed. |
| 2026-09-21 §6 — `KeyboardSensor` not wired | Note | `add-drag-and-drop` | Same: the interaction does not exist yet. Sharpened 2026-09-27 — registering the sensor is not sufficient; see the `coordinateGetter` row below. |
| 2026-09-27 §3 — what a `NOT_FOUND` failure should do to the board mid-move | Note | `add-drag-and-drop` | **Cashed in 2026-09-27**: the action revalidates on its `NOT_FOUND` branch, so a deleted card is not restored. Spec scenario added. Closed. |
| 2026-09-27 §3 — dnd-kit's default arrow-key step (25px) will not reach the next column | Note | `add-drag-and-drop` | **Cashed in 2026-09-27**: `KeyboardSensor` takes a column-aware `coordinateGetter`; task 2.1a and a spec scenario pin one press to one column. Closed. |
| 2026-09-21 §2 — commit the proposal before implementation | Minor | `add-drag-and-drop` | Applies to that change's history, not to work already done. |
| `R20260927-6` — wrap/clamp assertions check class substrings, so `line-clamp-3` -> `line-clamp-1` passes | Minor | **still open** | Same reason as the two guards above: jsdom has no layout engine, so no component test can measure it. The Playwright suite can, alongside tasks 4.2a and 4.2b. Until then the measured Chromium check in task 4.6 of `harden-kanban-board` stands as the manual version. |
| 2026-09-27 §4 — "read per request, not per build" has no automated guard | Major | `add-drag-and-drop` | The behavioural check is "a row inserted directly into the database appears on reload", which is an e2e check and lands with the Playwright suite. A source-inspecting unit test would pass against a misplaced call; a build-output assertion would put `next build` inside `npm run verify`. Both rejected with reasons in the change's design. Until then the requirement rests on a recorded manual check. |

## Closed — Declined

| Finding | Severity | Reason |
| --- | --- | --- |
| 2026-09-21 §1 — unused `@playwright/test` and `@dnd-kit` packages | Note | They are the dependencies of `add-drag-and-drop`, which is already proposed. Removing and reinstalling would churn the lockfile for no behavioural gain, and `@playwright/test` earned its keep by measuring the layout fix in `harden-kanban-board`. |
| 2026-09-21 §1 / Open question 1 — disabled "Add application" button has no requirement behind it | Minor | Kept for design fidelity, recorded in the `spec.md` Spec change log — the route `AGENTS.md` prescribes for scope beyond the spec. Becomes a working control in `add-application`. |
| `R20260927-7` — the red-then-green order in tasks 1.1, 1.3 and 4.x cannot be read out of git history | Minor | Unfixable after the fact, and manufacturing it would be worse than stating it. The change was committed as file groups once the work was done; the commits give granularity, not chronology. Said plainly in the disposition rather than implied away. Closed permanently. |
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

## Closed — Accepted (fixed), 2026-09-27 add-drag-and-drop review

| Finding | Severity | Fixed in |
| --- | --- | --- |
| `R20260927-8` — keyboard coordinate getter changed only `x`, so an arrow press across a row boundary stored the wrong status and Offer/Rejected were unreachable below 1280px | Major | `add-drag-and-drop` — geometry moved to `lib/applications/move.ts` with unit tests; a second Playwright project runs at 1100px |
| `R20260927-9` — one `pendingCardId` instead of a set let a second drag release the first card's handle before its write settled | Major | `add-drag-and-drop` — `useCardMoves` holds a set; six hook tests, including the interleaved case |
| `R20260927-10` — the "failed move leaves the board truthful" requirement had no test at any level | Major | `add-drag-and-drop` — reachable now that the coordination is a hook, so the action can be mocked |
| `R20260927-11` — `spec.md` gained no change-log entry for MVP item 3 | Minor | `add-drag-and-drop` |
| `R20260927-12` — focus lost after a keyboard move | Major→Minor as filed | `add-drag-and-drop` — restored only for keyboard moves; pinned by an e2e assertion |

## Open — not yet decided

Nothing. `R20260927-6`, the last entry here, was closed on 2026-10-01 — see the section at the end of
this file. The three error-boundary items listed as deferred there are recorded decisions, not
undecided findings.

Everything else from all four 2026-09-27 passes is closed above. The re-review
(`reviews/2026-09-27-harden-kanban-board-re-review.md`) returned PASS WITH NOTES with no blocking
follow-ups, and its two carried-forward Minor items are closed here under the IDs it assigned.

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

## 2026-09-29 — what `add-application` settled

| Finding | Where it stood | Now |
| --- | --- | --- |
| 2026-09-21 §3/§5 — no maximum field lengths on `company`, `position`, `link`, `notes` | Deferred to `add-application` | **Resolved.** `APPLICATION_LIMITS` (120/120/2048/2000) is enforced in `validateApplicationInput` against the trimmed value, with a test per field at the maximum and one character over, and a test that the raw length is not what is measured. Recorded in the `spec.md` data model and change log. |
| 2026-09-21 §1 / Open question 1 — disabled "Add application" button has no requirement behind it | Kept for design fidelity until MVP item 2 | **Resolved.** The placeholder is gone; the header now holds the dialog's trigger, and the `application-form` capability is the requirement behind it. |

No deferral now points at `add-application`.

`R20260927-6` (the clamp/wrap assertions match class substrings) stays **open**. Its note offered
`add-application` as a place to decide it, and this change did not take it up: it belongs to the
board's rendering, not to the form, and folding a rendered-height assertion into a change about
adding an application would be scope this change's proposal does not carry. Recorded here so the
next reviewer sees a decision rather than a silence — it needs its own change, or an explicit
written acceptance of the limit.

## 2026-09-29 — `add-application` review findings

| Finding | Severity | Resolution |
| --- | --- | --- |
| `R20260929-1` — a failed write escaped `createApplicationFromForm`, so React rethrew it during render and `app/error.tsx` replaced the page: the dialog, the typed values and an accurate account of the failure all went at once, under a message about a failed *read* | Critical | **Fixed.** Reproduced first (`components/application-form/probe`, then the committed red test in `app/actions/applications.test.ts`), then caught in the wrapper so `createApplication` keeps its signature and tests. The alert region built for this case is now reachable. |
| `R20260929-2` — a server-side refusal was announced to nobody: `aria-describedby` is read when a field next receives focus, not when its message appears | Major | **Fixed.** A refusal moves focus to the first field at fault in document order. Pinned by a test that also checks focus is left alone on success. |
| `R20260929-3` — commit `012436e` has no scope and bundles an e2e helper rename into a docs commit | Minor | **Accepted, not rewritten.** The finding is correct. History is left as it is rather than rewritten after review; the follow-up commits carry scopes and keep renames out of docs commits. |
| Open question 1 — do a textarea's line breaks arrive as CRLF? | — | **Measured, and it was a defect.** Chromium stored `\r\n`, so a note the field accepted at exactly 2000 characters reached the validator at 2000 + one per break and was refused by a message contradicting the screen. `validateApplicationInput` now normalises CRLF before trimming. A scenario was added to the change's delta spec, which was still ACTIVE. |
| Open question 2 — Cancel and Escape stay active while a submission is in flight | — | **Accepted as a recorded limitation**, author's decision 2026-09-29. Dismissing unmounts the form but does not cancel the action, so the application is still stored and appears on the board. Blocking Escape in a modal has its own accessibility cost, and the window is milliseconds against a local SQLite file. Recorded in the `spec.md` Spec change log rather than fixed; undoing it belongs to MVP item 4, which brings delete. |

The OpenSpec verification pass raised no critical items and four smaller ones; all four are closed —
`design.md`'s uncontrolled-form paragraph corrected, and e2e checks added for dismissal, for nothing
being shown that was not stored, and for the optional fields being stored as NULL.

## 2026-10-01 — the `R20260929-1` class, closed across every write path

`R20260929-1` was filed and fixed as one site: a failed write escaping
`createApplicationFromForm`. It was never one site. Found while exploring before MVP item 4, by
reading the actions rather than the diff:

| Site | State before | Severity if it had been filed |
| --- | --- | --- |
| `updateApplicationStatus` + `useCardMoves` | No `try`/`catch` anywhere on the path, and a live caller through drag-and-drop. A locked database during a move replaced the board, and `setPending` sat after the `await` so the card stayed held for good | Critical — the same defect as `R20260929-1`, in shipped behaviour |
| `updateApplication` | `catch` tested `P2025` and rethrew the rest | Latent: no caller yet |
| `deleteApplication` | Same | Latent: no caller yet |

Closed in `harden-write-failures`: every action ends in a catch-all returning `ActionResult`, so the
type is a guarantee rather than a hope, and `useCardMoves` releases the card in a `finally`. The
`try`/`catch` that `R20260929-1` added to the form wrapper is removed as dead code — the existing
test for it passes unchanged, because the action now returns the string the wrapper used to.

Two things this adds that no review asked for:

- `unstable_rethrow` runs first in every catch. `redirect()` and `notFound()` signal by throwing, so
  a catch-all would swallow them: the redirect would not happen and the action would report a
  failure for a write that succeeded. Nothing calls them today; MVP item 4 is where somebody will.
  Verified with the real throw — probed first, because a hand-built lookalike would pass against a
  guard that checks something else.
- Each `try` holds the storage call alone, with `revalidatePath` outside it. Reporting a failed
  cache call as "the application was not added" would be the same lie in a smaller place.

Not closed here, and not forgotten: `app/global-error.tsx` for a failure in `app/layout.tsx`,
narrowing `app/error.tsx` so a board render bug does not also remove the add control, and
`app/error.tsx`'s "failed to read them" wording. All three are about where boundaries sit. The
wording one is now weaker on purpose: no write reaches that boundary any more, so the message is
wrong only when something is already broken rather than on a routine, reachable path.

No entry in this ledger still describes the action convention as unenforced.

## 2026-10-01 — `harden-write-failures` review findings

PASS WITH NOTES, no blocking follow-ups. All three Minor were correct.

| Finding | Severity | Resolution |
| --- | --- | --- |
| `R20261001-1` — "lets the same card be moved again after a failed move" could not fail on its own assertion: `moveCard` has no pending guard, so the second call reached the action whether or not the card was released | Minor | **Fixed by deletion.** A test that cannot fail is worse than no test, because it reads as evidence. The scenario is pinned in the two places the behaviour lives — `isMovePending` returning to false, and `ApplicationCard` enabling the handle, which its own tests already cover. `tasks.md` 3.2 overstated it and now records what happened. |
| `R20261001-2` — the move-failure message was duplicated into `useCardMoves`, justified by `"use server"` not exporting constants | Minor | **Fixed, and the reasoning was wrong, not just the code.** That rule constrains what the actions file *exports*, not where a string lives. `FAILED` moved to `lib/applications/action-result.ts`; both files import it and the hook's test asserts the exact constant, so drift is impossible by construction. |
| `R20261001-3` — commit `400d43a` is labelled `docs` but removes the form wrapper's `catch`; `aabb2ae` is labelled `docs(openspec)` but adds a test assertion | Minor | **Accepted, not rewritten**, consistently with `R20260929-3`. The finding is correct and this instance is worse than that one: it hides a behaviour change, not a rename, so bisecting a form regression would skip it. Not rewritten because history is not rewritten after review, and because splitting it needs an interactive rebase this environment does not support. The rule going forward: a commit that touches a code path does not get a `docs` type, even when most of its diff is prose. |
| Open question — a `revalidatePath` failure after a successful move | — | **Resolved in `design.md`, intent stated.** The two decisions did pull against each other. The hook's `catch` governs: it is a net of last resort and cannot tell what it caught, so it may report "the move was not saved" for a move that was. The alternative is losing the board. Recorded as a risk rather than hidden. |

The reviewer declined to re-raise that this change's planning artifacts were committed after its code
(`74c3e62`). Noted here anyway, because it is true and the 2026-09-21 §2 finding was about exactly
that: the artifacts were written in explore mode before any code, but they reached git late.

## 2026-10-01 — `R20260927-6` closed, and two things it said corrected

Closed in `measure-long-value-layout`. The finding was that the clamp/wrap assertions match class
substrings, so `line-clamp-3` → `line-clamp-1` passes. Both halves of that framing turned out to be
off, and the correction is the reason the work took the shape it did.

**What the entry claimed, and what was true.**

- It said the e2e suite "measures page overflow, not the clamp depth". It did not. There was no
  `scrollWidth`, `clientWidth`, `boundingBox` or `overflow` anywhere in `e2e/`, and `git log -S` over
  that directory shows there never had been. The layout guarantee had *no* automated coverage at all,
  which is a larger gap than a weak assertion — and the entry read as though the serious half was
  already covered.
- Its example is not a spec violation. The requirement says a long value "SHALL wrap or be shortened",
  with no depth, so `line-clamp-1` satisfies it. A test that failed on a depth change would be pinning
  a promise the spec does not make. `measure-long-value-layout` task 2.4 therefore asserts the
  opposite of what the finding implied: the test must *keep passing* when the depth changes.

**What now holds it.** `e2e/long-value-layout.spec.ts` measures, in both the 1280 and 1100 projects,
with a 200-character unbroken company inserted straight into `e2e.db`: every column keeps the width it
had, the document does not scroll sideways, and the value's box stays inside its column. A separate
control test asserts the board is healthy *before* the long value exists, because a before-and-after
comparison passes when both sides are equally wrong.

**Proved non-vacuous by mutation.** Removing `line-clamp-3` overflows the page — `scrollWidth` 2087,
so 807px at 1280 and 987px at 1100 — while the grid tracks stay equal. Only the overflow assertion
catches it, which is why there are three measurements and not one. The archived note in
`harden-kanban-board` task 4.6 recorded 613px; it does not say at which viewport, so the numbers are
not comparable and the measured ones are what the test now holds.

**What was removed.** The `break-words` and `line-clamp-` substring assertions in
`ApplicationCard.test.tsx`. They could not fail for any reason the spec cares about and, beside a real
measurement, read as evidence they were not. The jsdom test keeps the clause jsdom can check — the
stored value is rendered in full — and is renamed to say so.

The change declared `skip_specs: true`: the requirement already said what is now measured, so only the
evidence changed.
