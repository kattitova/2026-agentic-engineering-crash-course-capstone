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

One, carried deliberately.

| Finding | Severity | Note |
| --- | --- | --- |
| `R20260927-6` — the clamp/wrap assertions match class substrings, so `line-clamp-3` → `line-clamp-1` passes | Minor | The deferral to Playwright was **not** honoured: the suite measures page overflow, not the clamp depth. The measured Chromium observation recorded in `harden-kanban-board` task 4.6 is still the only evidence. Decide in `add-application` or a later change — either add a rendered-height assertion or accept the limit in writing. |

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
