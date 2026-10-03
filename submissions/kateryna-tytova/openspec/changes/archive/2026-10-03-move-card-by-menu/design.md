# Design

## Context

See `proposal.md` — Why. What shapes the approach is what already exists.

A move today has exactly one owner and two activators that meet at the same place:

```
  pointer drag  --+
                  |
                  +--> handleDragEnd (Board.tsx)
                  |      |
  keyboard move --+      v
                     planCardMove(id, from, over?.id)   lib/applications/move.ts
                         |  null if: same column, no column, unknown status
                         v
                     moveCard(move)                     useBoardCards.ts
                         |
                         +--> optimistic { status, statusChangedAt }
                         +--> updateApplicationStatus   app/actions/applications
                         +--> hold the card / release / error message
```

Everything the spec guarantees about a move — the stored result, the counts, the
`appliedDate` recorded once, the hold while writing, the truthful failure, the day
badge and the stale flag — hangs off `moveCard`, not off the gesture. A third
activator that reaches `planCardMove` inherits all of it for free. One that did
its own write would have to re-earn every guarantee, which is the shape this
design exists to avoid.

Three existing facts constrain the work, each verified in the current code rather
than assumed:

1. `PointerSensor` has no `activationConstraint`, so `handleStart()` runs on
   `pointerdown` — and `handleStart()` is where dnd-kit adds a document-level
   `click` → `stopPropagation` listener. An `onClick` on the handle is therefore
   unreachable today, whatever is attached to it.
2. `KeyboardSensor.activators` calls `event.preventDefault()` on its start codes
   (Space, Enter), and `handleEnd` calls it again on the key that *drops* the card
   (`core.cjs.development.js:1328`). Both ends of a keyboard move are therefore
   suppressed, not just the pick-up — which matters because Space produces its
   click on `keyup`, so the drop is the half that could otherwise have opened the
   chooser the instant a keyboard move finished.
3. The handle's accessible name is `Move <company>`, and `e2e/keyboard-move.ts`
   plus `e2e/move-card.spec.ts` select it by that exact string.

## Goals / Non-Goals

**Goals:**

- One control, two gestures, no third code path to the server.
- The card and the column stay renderable outside a `DndContext`, which is the
  presentational split `DraggableCard` exists to preserve.
- The decision of *which statuses are offered* is a pure function, testable
  without a DOM, like `planCardMove` and `adjacentColumn` beside it.
- No change to the data model, the actions, `planStatusChange`, `useBoardCards`
  or `planCardMove`.

**Non-Goals:**

- Beyond the proposal's exclusions: no change to how a drag *looks* while it is
  in flight, no `DragOverlay`, no autoscroll tuning, and no change to the
  responsive grid. The columns stay stacked on a phone; the chooser is what makes
  that acceptable rather than a layout change.
- No new dependency. The chooser is a native `<dialog>`, not a menu library.

## Decisions

### 1. `activationConstraint: { distance: 5 }` on the existing `PointerSensor`

A tap must reach the handle's own `onClick`. Fact 1 above says it cannot today.
The constraint defers `handleStart()` — and so the click suppressor — until the
pointer has travelled 5px, which is the documented mechanism rather than a trick.

Alternatives considered:

- **`{ delay: 250, tolerance: 5 }`** — the canonical dnd-kit touch recipe. It
  would also have let the page scroll from the handle, which matters only if
  touch drag is being kept, and it is not. It costs every mouse drag a quarter
  second before it starts, which makes the trackpad case this change is partly
  for measurably worse.
- **A separate `TouchSensor` with the delay, leaving the mouse unconstrained** —
  this is the shape to use *if* touch drag is ever wanted. It needs no
  `onClick` route and so does not solve the problem at hand, and it only
  reintroduces the 2000px drag.
- **A fourth button beside the three already in the card header** — no sensor
  change at all, so no risk to the drag. Rejected because the header is already
  a heading plus three controls at 26px each in a 268px column, the long-value
  layout test measures that row, and a fourth control is the clutter the single
  handle was chosen to avoid.

Why 5 and not 8 or 3: it has to exceed the incidental movement of a click and
stay far below the distance to a neighbouring column (hundreds of pixels), so
anything in that range works and 5 is dnd-kit's own common figure. It is not a
tuned value and should not be presented as one.

### 2. The chooser is a native `<dialog>` with `showModal()`, one per board

The pattern `ConfirmDeleteDialog` already uses. `showModal()` gives the focus
trap, Escape, the inert background and focus restoration from the browser.

That the platform supplies them is not a reason to leave them unchecked, and this
project already decided that. `jsdom` implements neither `showModal()` nor
`close()`, so both existing dialog test files stub them
(`Board.test.tsx:73-79`, `ConfirmDeleteDialog.test.tsx:30-36`) — an Escape never
produces a `close`, and nothing is ever inert. The trap and the restoration are
pinned in e2e *because* they are the platform's: `e2e/edit-and-delete.spec.ts:266`
says in as many words that it is "the only place either is checked", and
`e2e/edit-and-delete.spec.ts:233-237` exists to catch "exactly what `show()` in
place of `showModal()` produces".

The dialog is described, as well as named: the "Currently in <column>." line is its
`aria-describedby`, the way `ConfirmDeleteDialog`'s body is. Focus lands on the first
choice when it opens, so without that the one fact the chooser exists to show — where
the card is now — is in the DOM but outside what is read out on opening.

A `MoveCardDialog` opened with `show()` would satisfy every component test and
break three of this change's scenarios. So the Escape, the inert background and
the focus-after-dismissal scenarios are e2e tasks, written the same way the edit
dialog's are, and the component tests cover only what jsdom can see: which
columns are offered, and that choosing one calls back.

One dialog for the whole board, mounted beside the edit and delete dialogs in
`Board.tsx`, not one per card — the same reason the comment there already gives:
a dialog inside a card would have to restore focus to a control that is about to
be unmounted, and a moved card *is* unmounted and re-rendered under another
column. This is the dialog most exposed to that, since moving is what it does.

Held state is the `JobApplication`, not its id, for the reason `editing` and
`deleting` already hold the object: looking the row up ties the dialog's open
state to the row still being in `shown`, and an optimistic move rewrites that
list the instant a column is chosen.

Alternatives considered: the `popover` attribute (newer, and the user ruled it
out); a non-modal listbox positioned under the handle (needs its own focus
management, outside-click dismissal and collision handling — all of which
`showModal()` provides).

### 3. `movableColumns(from)` in `lib/applications/move.ts`

```ts
movableColumns(from: ApplicationStatus): readonly BoardColumn[]
```

Returns `BOARD_COLUMNS` without the column the card is in, in funnel order. It
lives beside `planCardMove` and `adjacentColumn`, driven by `BOARD_COLUMNS` as
the single source of the five, and it is what the spec's "the current column is
shown but not offered" is tested against — without a DOM, and red-first as
`AGENTS.md` requires.

The dialog still needs the current status, to show it as current. It takes the
whole application, so it has it; the function answers only what can be chosen.

Why a function and not a filter inline in the dialog: `AGENTS.md` puts logic that
can be tested in isolation outside the component, and this is the third place
that would otherwise re-derive "the five, in order, minus one".

### 4. Choosing a column calls `planCardMove`, not `moveCard` directly

```
  onChoose(application, to)
      |
      v
  planCardMove(application.id, application.status, to)   <-- same validation
      |
      +-- null  --> nothing happens (cannot occur via the chooser, since the
      |             current column is not offered; kept because the chooser's
      v             `to` is still a value from the UI, and planCardMove is where
  moveCard(move)    an untrusted target is checked)
```

Going through `planCardMove` rather than around it is what makes "the same
guarantees whatever the means" hold without re-earning it.

"By construction" is not a substitute for a test, though, and it was written as
one here. A choice handler that called `updateApplicationStatus` directly would
satisfy "the action was called once with that status" — the only assertion a
component test makes about the chooser — while bypassing the optimistic
placement, the hold, the rollback and the failure message. That refactor is
precisely what the scenario forbids, so the failure path of a *menu* move gets
its own test, and it has to be one that fails if the write is made off
`moveCard`: a failed menu move must put the card back in its old column and show
the board's message. `useBoardCards.test.ts` cannot see this, because it tests
the hook and so cannot tell which path the chooser took to reach it.

### 5. Focus restoration reuses `focusCardId`, it does not add a second mechanism

`Board.tsx` already holds `focusCardId`, and `DraggableCard` already focuses the
handle via `shouldRestoreFocus` once the card is no longer busy. A menu move sets
the same state, exactly as a keyboard move does.

The one new case is a dismissal with no move: nothing unmounts, so the browser's
own `<dialog>` focus restoration handles it and `focusCardId` must stay `null`.

But that restoration returns focus to whatever was focused when `showModal()`
ran, and on a pointer-opened chooser that is the handle *only if clicking a
button focuses it*. Chromium does; WebKit does not — which is Safari, and so iOS,
the engine on the device this whole change exists for. Left as it is, "focus
after a dismissal" would pass in the e2e browser and fail on the target device,
which is the worst of both.

So the handle is focused explicitly before the chooser is opened. The click
handler focuses it, then sets the open state; the dialog then has a correct
element to restore to in either engine, and nothing has to run on the way out.

This is deliberately not the alternative of setting `focusCardId` on dismissal.
That would mean two mechanisms racing for the same focus in Chromium, where the
browser does restore it correctly — the objection the previous version of this
section made, which was right about the fix and wrong about there being nothing
to fix. Focusing before opening is the one move that is correct in both engines
and adds no state.

Note the ordering this inherits: `shouldRestoreFocus && !isCardBusy`, so focus
lands after the write settles. That is already true of keyboard moves and needs no
change — but it means a test asserting focus right after the choice would be
asserting the wrong moment.

### 6. The handle's label stays `Move <company>`

Fact 3. The spec asks only that the control be announced as moving its named
application, which `Move Acme Cloud` already does. Widening it to describe both
gestures would break two e2e files and tell a screen-reader user about a pointer
distinction that does not apply to them.

## Risks / Trade-offs

- **The `activationConstraint` affects every pointer drag and nothing tests a
  pointer drag.** Every e2e move goes through `moveRightWithKeyboard`, and
  `KeyboardSensor` takes no constraint, so a mouse drag broken by this would pass
  the whole suite. This is the one change here that can break working behaviour.
  → A pointer drag goes into the e2e suite, driven with `page.mouse`, which
  dnd-kit's `PointerSensor` responds to in Chromium. A manual check would leave
  the next edit to the sensor config unguarded, and the sensor config is exactly
  the thing this change teaches someone to edit.
- **A 5px threshold could swallow a very short deliberate drag.** → It cannot
  reach another column in 5px, so a drag that short has no valid outcome either
  way; the worst case is a chooser opening where a no-op drag was intended, which
  is dismissible.
- **`jsdom` cannot drive a dnd-kit *drag*** — a drag needs real layout and real
  droppable rects. But the click-versus-drag decision is made from pointer event
  coordinates alone, not from layout, so the threshold itself is reachable in
  jsdom: `pointerdown` → `pointerup` → `click` on the handle inside `Board`
  should open the chooser *with* the constraint and not without it. → That goes
  in as the regression test for decision 1, which is otherwise only covered end
  to end. If jsdom turns out not to supply what the sensor's activator needs from
  a pointer event, the e2e drag is the fallback and this is dropped rather than
  worked around.
- **Touch drag stays visibly broken.** A finger on the handle will still appear to
  grab the card and then scroll the page. → Accepted and recorded in `spec.md`, so
  the next person reading the code finds a decision rather than a bug. The tap now
  reaches a working path, which is what makes the leftover gesture a wart rather
  than a dead end.
- **Three dialogs now live in `Board.tsx`.** → Still one of each for the whole
  board, which is the established shape there; if a fourth appears, that is the
  point to extract them, not now.

## Open Questions

1. **Whether a `keydown` `preventDefault()` suppresses the Space `keyup` click in
   Firefox and WebKit.** It does in Chromium, and fact 2 above establishes that
   dnd-kit calls `preventDefault()` on both the pick-up and the drop, so the
   exposure is one engine-specific behaviour rather than a gap in the wiring. Both
   Playwright projects are Desktop Chrome, so the e2e suite will not answer it.

   Safe to defer: if an engine did synthesise the click, the symptom is a chooser
   opening right after a keyboard drop — visible, dismissible, and no data is
   written by it. The fix would be local to the click handler (ignore a click
   whose `detail` is 0, or one arriving within the sensor's own 50ms window), and
   it changes neither the specs, the approach, nor the task list.

The keyboard-opening question, the sensor-constraint shape, the dialog mechanism
and the focus restoration were each resolved above rather than deferred.
