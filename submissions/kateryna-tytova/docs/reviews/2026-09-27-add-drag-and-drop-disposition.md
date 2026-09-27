# 2026-09-27 — disposition of the add-drag-and-drop review

Written by the author. Every finding of
[the review](2026-09-27-add-drag-and-drop.md) is accounted for below. The change was still
active — implemented but not archived — so the fixes went into it rather than into a new change.

Each Major was reproduced before it was accepted. One of the review's own claims did not survive
that check, and is corrected below.

## Resolved

| Finding | Resolution | Evidence |
| --- | --- | --- |
| `R20260927-8` [Major] coordinate getter changed only `x` | rect-to-column reasoning moved to `lib/applications/move.ts` (`columnAtPoint`, `keyboardStep`), resolving both axes | reproduced first: at 1100px, picking up a card in Interview and pressing ArrowRight announced `WISHLIST`. After the fix, verified at 1100px, 800px and 1280px — one press always lands on the next funnel column |
| `R20260927-9` [Major] one `pendingCardId` instead of a set | `useCardMoves` holds a set and each write releases only its own card | six hook tests, including "keeps a first card held when a second card is moved before it settles" |
| `R20260927-10` [Major] failure path untested at any level | the coordination is a hook, so the action can be mocked and all three scenarios are reachable | rollback, message, and release-on-failure are asserted in `useCardMoves.test.ts` |
| `R20260927-11` [Minor] no `spec.md` entry for MVP item 3 | Spec change log entry added, naming the three non-obvious decisions | `spec.md` |
| `R20260927-12` [Minor] focus lost after a keyboard move | restored to the moved card's handle, and only for keyboard moves — after a pointer drag the ring would be unasked for | e2e: "leaves focus on the moved card after a keyboard move" |

## Correction to the review

`R20260927-8` also argued that the "where is the card now" lookup, which matched a column by
`rect.left === collisionRect.left`, made the *second* arrow press walk from the wrong column even
at `xl`. Checked before fixing: two presses at 1280px announced Interview then Offer, correctly.
The match happened to hold because the getter set `x` to exactly that edge. The finding's
conclusion stands — the lookup was wrong and is now centre-based — but that particular consequence
did not reproduce.

## Found while fixing, not in the review

- **A real flake, 3 runs in 15, present before this review.** dnd-kit attaches its keydown listener
  inside a `setTimeout` (`@dnd-kit/core/dist/core.cjs.development.js:1163`), so for one macrotask
  the drag is active and announced while no listener exists, and an arrow key is dropped. Confirmed
  by instrumenting the coordinate getter: on the failing runs it was never called, while focus and
  `aria-pressed` were correct. The spec now yields one macrotask after the pick-up announcement,
  which is ordered after dnd-kit's own timeout. 40 of 40 across four repeats of both projects.
- **Droppables were measured only after the drag started**, leaving the coordinate getter with no
  rectangles on a fast key press. `DndContext` now measures them up front.
- **The suite only ever ran at 1280px** — exactly the `xl` breakpoint, and the one width at which
  `R20260927-8` was invisible. This answers the review's first open question: a second Playwright
  project now runs at 1100px, and it is not optional, it is what guards the fix.

## Carried, with a reason

- **`R20260927-6` [Minor]** — the clamp/wrap assertions still match class substrings, so
  `line-clamp-3` → `line-clamp-1` passes. The deferral to Playwright was **not** honoured: the
  suite measures page overflow, not clamp depth. Said plainly rather than marked done. Recorded in
  `decisions.md` as the one open item.

## The review's other open questions

- **Coupling the suite to dnd-kit's live-region wording.** Accepted for now. It is the only signal
  the library exposes for "the sensor has processed that step", and the alternative is fixed
  delays, which is what produced the flake in the first place. If a minor upgrade rewords it, the
  suite fails loudly rather than silently, which is the right failure mode.
- **`resetBoard` restores `status` only, and its `DELETE … NOT IN` list is hand-sized to three
  rows.** Left as is, because `npm run e2e:db` force-resets the schema per run. Worth revisiting
  when a fourth seeded row arrives.
