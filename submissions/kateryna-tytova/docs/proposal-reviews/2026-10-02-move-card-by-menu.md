# 2026-10-02 — move-card-by-menu

**Reviewer:** proposal-reviewer sub-agent (separate session; planner ≠ checker)
**Pass:** first
**Launched:** as a sub-agent. The prompt named the change and repeated the procedure from the agent
definition (resolve scope, read the ledger and earlier passes, write one file with a verdict). It
listed no things to check, so this is a neutral pass.
**Reviewed:** `openspec/changes/move-card-by-menu/` — `proposal.md`, `design.md`, `tasks.md`,
`specs/kanban-board/spec.md`, `.openspec.yaml` (untracked, so uncommitted)
**Structural validation:** `openspec validate move-card-by-menu --strict` → `Change 'move-card-by-menu' is valid`
**Implementation state:** not started. No task is checked off, and the working tree changes only
`.agent-log/actions.jsonl` besides the untracked change directory.
**Verdict:** REVISE PROPOSAL — 0 critical, 2 major, 4 minor

## Previously decided — not re-raised

| Ledger entry | Why it is relevant here | Status |
| --- | --- | --- |
| `R20260927-12` — focus lost after a keyboard move (Accepted, fixed in `add-drag-and-drop`) | The plan reuses that mechanism (`focusCardId` → `DraggableCard.tsx:46-51`) for a menu move. Cited as context only. | Closed — Accepted |
| 2026-09-21 §6 / 2026-09-27 `coordinateGetter` — keyboard sensor wiring | The plan keeps the keyboard path as it is (`Board.tsx:137`). Nothing to raise. | Closed — Cashed in |
| `R20261001-1` — "moveCard has no pending guard", so a test of re-moving a card could not fail | This is why the "busy card cannot be moved by the chooser" check has to go through the disabled handle (`ApplicationCard.tsx:163`) and not through `moveCard`. Task 3.7 does that. No finding. | Closed — Accepted |

No Deferred entry in `docs/reviews/decisions.md` names this change, a menu move or touch input, so
there is no deferral to cash in.

## 1. Scope against `spec.md`

- **[Minor]** `P20261002-3` `tasks.md:99-104` — MVP item 3 says "**Drag** a card between columns"
  (`spec.md:52`). The 2026-09-29 and 2026-10-01 entries say status has no picker and "is owned by
  the drag-and-drop path" (`spec.md:148-149`, `spec.md:199-201`). A chooser that sets status is
  therefore a deliberate widening of item 3. The plan does say why it is needed now: the "work
  reasonably well" non-goal, `spec.md:67`, against a status that cannot be reached on touch. Task
  6.1 writes that entry. The only problem is the order: 6.1 is the last implementation task and
  lands after the code. `AGENTS.md` → "Scope" asks for `spec.md` to be updated *first*. Not
  blocking, because the entry exists and its content is right. Moving 6.1 to the front of the task
  list makes the history match the rule.

## 2. Requirement coverage and testability

- **[Major]** `P20261002-1` `specs/kanban-board/spec.md:80-81, 90-98, 113-116` — three scenarios
  reach no task:
  - "Dismissed with the keyboard" (Escape)
  - "The board behind is not operable"
  - "Focus after a dismissal"

  All three are the native `<dialog>`'s behaviour, and none of them can be observed in this
  project's component tests. jsdom implements neither `showModal()` nor `close()`, and every dialog
  test stubs them (`Board.test.tsx:60-79`, `ConfirmDeleteDialog.test.tsx:27-34`), so an Escape
  never fires `cancel`/`close` and nothing is ever inert. In task 2.2, "`onCancel` fires on
  dismissal" (`tasks.md:31-32`) can therefore only mean a button or a hand-dispatched `close`
  event. It does not cover the key. Design §2 (`design.md:97-100`) offers "met by the platform
  instead of by code this project would have to test" as the reason. That is not the project's own
  standard. For both existing dialogs, the trap and the restoration are pinned in e2e precisely
  because the platform supplies them:
  - `e2e/edit-and-delete.spec.ts:266-268`: "the only place either is checked"
  - `e2e/edit-and-delete.spec.ts:233-237` and `e2e/add-application.spec.ts:166-168`: "which is
    exactly what show() in place of showModal() produces"

  If the plan is implemented as written, a `MoveCardDialog` opened with `show()` instead of
  `showModal()` passes every task's verification while breaking all three scenarios. Section 4's
  e2e tasks cover the move path only: 4.1 covers the move and the reload, and 4.2 covers focus
  after a *move*.
- **[Major]** `P20261002-2` `specs/kanban-board/spec.md:209-213` — "The same failure handling
  whatever the means" is a scenario this change adds specifically for a chooser move, and no task
  reaches it:
  - 3.7 (`tasks.md:64-67`) asserts that the chooser opens, that "choosing a column calls the status
    action once with that status", and the busy case.
  - 4.1 and 4.2 cover only success.

  Design §4 (`design.md:151-152`) says sharing `planCardMove` → `moveCard` makes the guarantee
  "true by construction instead of by inspection". But 3.7's assertion would also pass if the
  choice handler called `updateApplicationStatus` directly and bypassed `moveCard`. That is the one
  refactor the scenario exists to forbid, and the failure would then be neither rolled back nor
  reported. Today the failure behaviour is tested only through the hook (`useBoardCards.test.ts`),
  which cannot see which path the chooser takes. Section 5 of this file explains why this counts as
  a Major and not a "the code shares it" note: it is a requirement with no test that could fail.

The remaining scenarios are covered:

- The four chooser-content scenarios are covered by 1.1 and 2.2.
- "A card is moved without dragging" and the reload are covered by 3.7 and 4.1.
- Focus after a move is covered by 4.2.
- The busy hold is covered by 3.7.
- "A move is not an edit or a deletion" is covered by 3.6.
- The pointer gesture split ("Pressed and moved", "A click with incidental movement") and the
  touch case are named as manual checks in 5.1 and 5.2, with reasons given. See `P20261002-5` for
  the one reason that does not hold.
- The keyboard scenario relies on 4.3. The existing suite would fail if a modal opened on Space,
  because the next `ArrowRight` and the focus assertion at `e2e/move-card.spec.ts:41-43` would both
  miss.

The two MODIFIED requirements restate every scenario of their originals
(`openspec/specs/kanban-board/spec.md:213-244, 343-379`), so none is dropped on archive. I found no
contradiction with the unmodified requirements ("Dropping a card in its own column changes
nothing", "A card can be moved with the keyboard", "The controls do not distort the card").

## 3. Impact accuracy against the real code

Every claim I checked holds:

- **`PointerSensor` has no constraint.** It is registered bare (`Board.tsx:134`).
- **Without a constraint, a press is already a drag.** The sensor calls `handleStart()` straight
  from `attach()` (`node_modules/@dnd-kit/core/dist/core.esm.js:1471`). `handleStart()` adds a
  capture-phase `click` → `stopPropagation` on the document (`core.esm.js:1506-1508`) and removes
  it only 50ms after `pointerup` (`core.esm.js:1479`). An `onClick` on the handle is unreachable
  today, exactly as design fact 1 says.
- **A distance constraint changes that.** It defers `handleStart()` to the first move past the
  threshold (`core.esm.js:1465-1468, 1545-1546`).
- **The keyboard activator calls `preventDefault()`** on its start codes (`core.esm.js:1384-1386`),
  which are Space and Enter (`core.esm.js:1098-1102`).
- **Touch drag cancels.** Nothing sets `touch-action` anywhere in the app (grep returned nothing),
  and the sensor cancels on `pointercancel` (`core.esm.js` `events.cancel`).
- **Every e2e move uses the keyboard helper.** The handle is selected by `Move <company>` at
  `e2e/keyboard-move.ts:29` and `e2e/move-card.spec.ts:42`. No e2e file uses `page.mouse`,
  `dragTo` or a pointer event.
- **Board state holds the object.** `editing`/`deleting` hold the `JobApplication`
  (`Board.tsx:113-114`), and focus restoration waits for `!isCardBusy` (`DraggableCard.tsx:46-51`).
- **The handle is 26px.** That is `p-1.5` plus a 14px icon (`ApplicationCard.tsx:17, 169`).
- **The edit form leaves status alone** (`spec.md:195-206`).
- **The prop-threading pattern exists.** `BoardColumn` threads `onEdit`/`onDelete` into
  `DraggableCard` (`BoardColumn.tsx:72-88`).
- **No new dependency is needed.**

- **[Minor]** `P20261002-4` `proposal.md:97-98` — Impact says the handle's "accessible name must
  say it does both things". The same proposal (`proposal.md:122-125`), design §6
  (`design.md:170-175`) and task 3.2 (`tasks.md:43-45`) all say it must stay `Move <company>`.
  Impact also promises "component tests … for the handle's two gestures" (`proposal.md:105-106`),
  while design (`design.md:189-192`) says a component test cannot tell the two gestures apart, and
  3.6 tests the click only. An implementer who reads Impact as the checklist would widen the label
  and break both e2e files. The tasks are right; the two Impact lines are stale.

## 4. Tasks

Red-first is respected for the one piece of business logic: 1.1 is a failing test and 1.2 makes it
pass. Order is executable, no rename is mixed in, and every new interaction has a test task. The
exit runs in the right order: 6.2 `npm run verify` → 6.3 `openspec verify` → 6.4 *ask* about
`reviewer`. 6.4 and 6.5 say "Ask" and "Do not launch it" in words that cannot be read as
authorising a silent launch.

- **[Minor]** `P20261002-5` `tasks.md:85-91` — the section is titled "Checks the suite cannot
  make", but its first check is one the suite can make. Playwright drives a pointer drag through
  `page.mouse.down/move/up`, and dnd-kit's `PointerSensor` responds to it in Chromium. What is true
  is that nothing in the suite does this *yet*, which is what 5.1's body says. Design marks the
  sensor change as "the one change here that can break working behaviour" (`design.md:179-184`),
  so leaving it as a one-off manual check means the next edit to the sensor config is unguarded.
  The same applies to the "a few pixels" click: `page.mouse` can move 2px. Separately, "the apply
  notes" (`tasks.md:90`) names no file, so the result has no defined home.
- **[Minor]** `P20261002-6` `tasks.md:42-59` — 3.2, 3.4 and 3.5 state no verification. Downstream
  tasks do check them (3.6, 3.7, 4.1, 4.2), so this is wording, not a hole. Naming which later task
  verifies each one would let each commit say how it was checked.

## 5. Design decisions

Each decision names the alternative it rejected:

- Decision 1 rejects delay plus tolerance, a separate `TouchSensor`, and a fourth button.
- Decision 2 rejects `popover` and a non-modal listbox.
- Decision 3 rejects an inline filter.
- Decision 6 rejects a wider label.

Nothing is irreversible: there is no schema change, and `prisma/schema.prisma` is untouched. The
decisions agree with the ledger and with the archived `add-drag-and-drop` and
`edit-and-delete-application` designs. That includes holding the object rather than the id, and
one dialog per board.

Design §2's "four of the spec's requirements met by the platform" is the load-bearing reason
behind `P20261002-1`, and it is reported there, not twice. Two platform claims are not verifiable
from here and are listed under Open questions.

No findings beyond the cross-reference above.

## Open questions

1. **Focus restoration after a dismissal outside Chromium.** Design §5 (`design.md:161-163`)
   relies on `<dialog>` returning focus to the element that was focused when `showModal()` ran. On
   a pointer-opened chooser, that is the handle only if clicking a button focuses it. That is true
   in Chromium, but WebKit (macOS Safari, and iOS, the device this change is for) does not focus a
   button on click, so focus would return to `<body>`. I could not run WebKit here. If it holds,
   "Focus after a dismissal" is met in the e2e browser and not on the target device. Setting
   `focusCardId` on dismissal, which design rejects, or focusing the handle before `showModal()`
   are the obvious alternatives. This is the author's call.
2. **The Space key-up click outside Chromium.** Fact 2 (`design.md:39-41`) holds for Enter, whose
   click comes from `keydown`. For Space, the click comes from `keyup`. Whether a `preventDefault()`
   on `keydown` suppresses it is up to each browser engine. Chromium does suppress it, and 4.3
   would catch a regression there. Firefox and WebKit are unverified, and the Playwright projects
   are both "Desktop Chrome" (`playwright.config.ts:20, 24`). The risky path is a keyboard *drop*
   with Space (`core.esm.js:1101`), followed by a click that opens the chooser.
3. **"jsdom cannot drive dnd-kit" (`design.md:189`).** The click-versus-drag split is decided from
   pointer event coordinates (`core.esm.js:1532-1546`), not from layout. A jsdom test that fires
   `pointerdown` → `pointerup` → `click` on the handle inside `Board` might pass only with the
   constraint in place, which would be a cheap regression test for 3.1. I did not verify that jsdom
   delivers `isPrimary`/`button` as the activator requires (`core.esm.js` `PointerSensor.activators`).

## Must be revised before apply

1. `P20261002-1` (Major) — the Escape, inert-background and focus-after-dismissal scenarios have
   no task, and only a real browser can check them.
2. `P20261002-2` (Major) — "the same failure handling whatever the means" has no task. The only
   chooser assertion would pass for a handler that bypasses `moveCard`.

## Non-blocking suggestions — implementation does not depend on these

- `P20261002-3` — move the `spec.md` entry (6.1) ahead of the code, as `AGENTS.md` → "Scope" asks.
- `P20261002-4` — two Impact lines contradict the decision to keep the label `Move <company>`.
- `P20261002-5` — "cannot make" is false for the pointer drag, and "apply notes" has no location.
- `P20261002-6` — 3.2, 3.4 and 3.5 should name the task that verifies them.
