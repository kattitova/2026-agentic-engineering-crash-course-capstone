# Proposal

## Why

On a touch device there is no way to change an application's status. The pointer
drag dies the moment the finger moves: `PointerSensor` activates on `pointerdown`,
the browser then claims the gesture for scrolling because nothing sets
`touch-action: none`, and the resulting `pointercancel` cancels the drag. The
keyboard path exists and works, but a phone has no arrow keys, and the edit form
deliberately omits `status`. So the one thing the board is for — moving an
application along the funnel — is unreachable on the device the board is most
likely to be opened on.

This also fails a desktop case that was never designed for: the drag handle is a
26px target that must be pressed and held, which is awkward on a trackpad. A
second, non-gestural way to move a card fixes both with one control.

## What Changes

- The existing drag handle on each card gains a second gesture. Pressed and
  moved, it drags exactly as it does now. Tapped or clicked without movement, it
  opens a chooser naming the five statuses, and picking one moves the card.
- `PointerSensor` gains `activationConstraint: { distance: 5 }`. This is what
  makes the two gestures distinguishable, and it is load-bearing rather than
  cosmetic: dnd-kit installs a document-level click suppressor inside
  `handleStart()`, so without the constraint the handle's own click is swallowed
  and no tap can ever reach it. The constraint also stops a trackpad's
  micro-movement from registering as a drag.
- A chooser dialog is added to the board, beside the edit and delete dialogs it
  already holds. It is a native `<dialog>` opened with `showModal()`, the same
  mechanism `ConfirmDeleteDialog` uses.
- A new pure function decides which statuses a card can move to, so the card's
  current status is shown as current and is not offered as a move.
- A menu move goes through `planCardMove` → `moveCard`, the same path a drop
  takes. `status`, `appliedDate` and `statusChangedAt` keep one owner; the move
  acquires a second *activator*, not a second set of rules.
- Focus returns to the handle after a menu move, as it already does after a
  keyboard move.

Not breaking: every behaviour that exists today — pointer drag, keyboard move,
the optimistic placement, the failure handling, the day badge and the stale flag
— is reached by the same code and is unchanged.

### Deliberately not in this change

- **Touch drag is left broken.** `touch-action: none` is not added. Even with the
  gesture working, the board is `grid-cols-1` on a phone, so the five columns
  stack and a Wishlist → Offer drag needs roughly 2000px of autoscroll with the
  finger held down. A drag that technically functions and is unusable is worth
  less than the menu, and fixing it would cost the page's own vertical scroll
  wherever the finger lands on a handle. `spec.md`'s non-goal — mobile "just
  needs to work reasonably well" — permits leaving the gesture out; it does not
  permit leaving the status unreachable, which is what this change fixes.
- **No device or pointer detection.** The menu is offered unconditionally, not
  swapped in for touch. Deciding from `matchMedia('(pointer: coarse)')` needs
  `window`, which the server does not have, so it renders differently on the
  server and on hydration — the exact failure the required `now` prop and the
  fixed `DndContext id` already exist to prevent. It also reports wrongly on a
  touchscreen laptop or a tablet with a trackpad, and it would withhold the menu
  from the trackpad and screen-reader users who most need it.
- **No `<select>` in the card.** A form control in the card reads as "this is
  editable here", which contradicts editing living in a dialog, and it would
  restate the status the column heading already carries.
- **The chooser is not opened from the keyboard.** Space and Enter on the handle
  already start a keyboard drag, and dnd-kit's keyboard activator calls
  `preventDefault()` on both, so no click is synthesised and the two cannot
  collide. Freeing one of those keys for the chooser would mean replacing
  dnd-kit's whole key table, which is what the existing arrow-key path runs on.
  A keyboard user loses nothing: they can already reach every column by arrow
  keys, a path three separate flakes were paid to stabilise. They gain only
  fewer key presses, which is not worth risking it for in this change.

## Capabilities

### New Capabilities

None. This extends how an existing behaviour is reached.

### Modified Capabilities

- `kanban-board`: moving a card is currently specified as a drop or a keyboard
  move. It gains a third way to be activated, specified as behaviour rather than
  as a gesture, with the existing guarantees (status stored, counts follow,
  `appliedDate` recorded once, a card held while its write is in flight, a
  failure reported truthfully, the badge and flag recalculated) applying to it
  unchanged. The requirement that a card's controls are not drag sources is
  extended to say what the handle does on each gesture. The pointer drag's
  reliance on a pointing device that can press and hold is stated as a limit,
  so the menu is the specified way on a device that cannot.

## Impact

Code:

- `components/board/Board.tsx` — the `activationConstraint`, the chooser's open
  state, and the dialog mounted beside the two existing ones.
- `components/board/ApplicationCard.tsx` — the handle gains an `onClick`. Its
  accessible name stays `Move <company>`: see the constraint at the end of this
  section.
- `components/board/DraggableCard.tsx` — passes the handler through and keeps
  owning focus restoration.
- `components/board/BoardColumn.tsx` — passes the handler through.
- `components/board/MoveCardDialog.tsx` — new.
- `lib/applications/move.ts` — new pure function for the offered statuses.
- `lib/applications/move.test.ts` — red-first test for it.
- Component tests for the dialog and for the handle's click;
  `components/board/Board.test.tsx` and `ApplicationCard.test.tsx` for the
  changed handle. The two *gestures* cannot be told apart in a component test
  beyond the sensor's own threshold — see design §1 and the sensor regression
  test in task 4.9.
- `e2e/move-card.spec.ts` or a sibling spec — a menu move that survives a reload,
  the chooser's Escape, inert background and focus-after-dismissal, a failed menu
  move, and a pointer drag (which nothing drives today).
- `spec.md` — change-log entry recording the second activator with one owner, and
  that touch drag is knowingly left broken.

Not affected: `prisma/schema.prisma`, the server actions, `planStatusChange`,
`useBoardCards`, and `planCardMove` itself. No dependency is added or changed.

Risk: the `activationConstraint` changes when a drag starts for every pointer,
including the mouse, and nothing in the suite drives a pointer drag today — every
e2e move goes through `moveRightWithKeyboard`, and `KeyboardSensor` takes no
`activationConstraint`. So a pointer drag broken by the constraint would be
caught by nothing that exists. This change therefore adds a pointer drag to the
e2e suite rather than leaving it to a one-off manual check: the sensor config is
the thing most likely to be edited again.

Risk: focus restoration after the chooser is dismissed depends on the handle
having been focused when the chooser opened, and a click does not focus a button
in WebKit — the engine on the device this change exists for. The handle is
therefore focused explicitly before the chooser opens, rather than relying on the
click to have done it. See design §5.

Constraint on the handle's accessible name: it must stay `Move <company>`.
`e2e/keyboard-move.ts` and `e2e/move-card.spec.ts` both select the handle by that
exact name, so widening the label to mention both gestures would break the
keyboard suite. The existing name already satisfies the spec.
