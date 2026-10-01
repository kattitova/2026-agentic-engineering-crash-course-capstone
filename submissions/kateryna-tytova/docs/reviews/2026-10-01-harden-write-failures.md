# 2026-10-01 — harden-write-failures

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review. This is a new OpenSpec change that the author started after reading the
actions. It is not a response to a blocking finding: `R20260929-1` was already fixed and passed
re-review. It does extend that finding's class to sites the 2026-09-29 review never saw. Per the
agent definition, new Minor findings are limited to this diff.
**Reviewed:** `git diff 868fbca..HEAD`, i.e. commits `d0c55cc` (red), `57b590c` (green),
`6e2c64e`, `8df1fba` (red), `cf25f98` (green), `400d43a`, `74c3e62`, `aabb2ae`. Files:
`app/actions/applications.ts` and its test, `components/board/useCardMoves.ts` and its test,
`spec.md`, `docs/reviews/decisions.md`, and the change's proposal, design, tasks and delta spec.
All of it is committed. The only uncommitted file is `.agent-log/actions.jsonl`, which is outside
the change.
**Verification run:** `npm run verify`: lint, typecheck and 108 tests in 9 files all pass. I did not
run `npm run test:e2e`, because it rebuilds the app and resets `e2e.db`, which is a write. This
change adds no e2e tests, and the design says so.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 3 minor

## Previously decided — not re-raised

| Closed item | Status in the ledger | What I did |
| --- | --- | --- |
| `R20260929-1`: a failed write escaped the form wrapper | Fixed. The 2026-10-01 ledger entry closes the class | I checked that this change does not reopen it. The wrapper's `catch` is gone, but `createApplication` now returns the same string, and the existing form test still passes against it (see §1). |
| `R20260929-3`: an unscoped docs commit bundled an unrelated change | Accepted, not rewritten | Not re-raised. `R20261001-3` below is a new instance in this diff, not the old commit. |
| 2026-09-21 §2: commit the proposal before implementation | Deferred to `add-drag-and-drop`, scoped to that change's history | Not raised, even though this change's proposal, design and delta spec were committed after the code (`74c3e62`). |
| `R20260927-6`: clamp/wrap assertions match class substrings | Open, explicitly kept out of form/action changes | Not raised. This diff does not touch rendering. |
| `app/global-error.tsx`, narrowing `app/error.tsx`, its "failed to read" wording | Listed as not closed in the 2026-10-01 ledger entry and as non-goals in the proposal | Not raised. They are out of scope by the proposal's own terms. |

## 1. Spec compliance

No findings.

How each scenario in the delta spec is satisfied:

- **"The storage fails in a way it cannot describe".** A rejecting `$transaction` returns
  `{ ok: false, error: FAILED.move }` (`applications.ts:116-129`), so the hook takes the ordinary
  `!result.ok` branch. If the action ever rejects anyway, the hook's own `catch`
  (`useCardMoves.ts:52-60`) sets the error, so the board is never handed to `app/error.tsx`. The
  optimistic move unwinds when the transition ends, because `useOptimistic` derives from
  `applications`.
- **"A card can be moved again after a failed move".** `setPending` now runs in `finally`
  (`useCardMoves.ts:61-70`). `DraggableCard.tsx:33` and `ApplicationCard.tsx:62` derive `disabled`
  from `isMovePending`, so releasing the id re-enables the handle.
- **"The application was deleted while the move was in flight".** The `!application` branch still
  revalidates and returns `NOT_FOUND`, and a test pins it (`applications.test.ts`, "still says the
  application was not found").
- **"The write fails" and "The board stays truthful".** No behaviour change on these paths.

Every action in the proposal's "What Changes" landed. `updateApplication` and `deleteApplication`
still let `P2025` win over the catch-all. The tests construct the real
`PrismaClientKnownRequestError`, so the `instanceof` in `isRecordNotFound` is actually exercised.
I found no code without a requirement behind it. The `catch` in the hook is recorded in
`design.md` as an addition made during implementation.

## 2. AGENTS.md compliance

- **[Minor]** `R20261001-3` commit `400d43a` — the commit is titled
  `docs: record that the action convention is now enforced`, has no scope, and its body describes
  only documentation. It also removes the `try`/`catch` from `createApplicationFromForm` (task 5.1),
  which changes the error path of the only form that writes. Someone reading the history or
  bisecting a form regression would skip a commit labelled `docs`. AGENTS.md requires
  `type(scope)` and one logical change per commit. The same holds on a smaller scale for
  `aabb2ae` (`docs(openspec)`), which adds a test assertion.

Everything else is clean. Red preceded green and can be read from the history (`d0c55cc` →
`57b590c`/`6e2c64e`, `8df1fba` → `cf25f98`). There is no `any`, no schema change, and no
pnpm/yarn. `spec.md` gained change-log entries in the same series.

## 3. Edge cases

No findings.

- **A card dragged twice quickly.** The pending set is unchanged in shape. Release is per
  `cardId` in `finally`, so a failure on card A cannot release card B.
- **A drop into the same status.** `planStatusChange` still returns no change, and the
  transaction returns `current` without writing, so `statusChangedAt` is untouched.
- **A delete while a move is in flight.** The `NOT_FOUND` branch is untouched and sits outside the
  new `try`, so it still revalidates.
- **Form fields and an out-of-enum status.** Validation and `isApplicationStatus` run before the
  `try`, and this diff does not change them.
- **A Next control-flow throw.** `isRecordNotFound` runs before `failed()` in
  `updateApplication` and `deleteApplication`. A redirect error is not a
  `PrismaClientKnownRequestError`, so it still reaches `unstable_rethrow`. The test uses the real
  `redirect()` throw, not a lookalike.

## 4. Test strength

- **[Minor]** `R20261001-1` `components/board/useCardMoves.test.ts:213-227` — "lets the same card be
  moved again after a failed move" cannot fail on its own assertion. `moveCard` has no
  pending-card guard. The guard is the `disabled` prop in `DraggableCard`/`ApplicationCard`. So the
  hook calls `updateApplicationStatus` a second time even when the card is still held, and
  `toHaveBeenCalledTimes(2)` holds either way. A mutation that leaves the card pending fails this
  test only at the precondition `waitFor` on line 222. The previous test already makes that same
  assertion. The scenario is still pinned, by that `isMovePending("a") === false` assertion plus
  the existing `disabled` wiring, which is why this is Minor. But this test adds no evidence
  of its own, and task 3.2's description overstates it.

The four "reports it instead of throwing" tests compare the whole result with `toEqual`, so a
leaked driver message or a missing `ok: false` would fail them. The redirect tests fail if
`unstable_rethrow` is removed from `failed()`, because the action would then resolve to
`{ ok: false }`.

## 5. Input safety

No findings. The unclassified-failure message is a fixed string per action, and the tests assert
it exactly, so driver text, paths or connection strings cannot reach the client. `console.error`
logs on the server only. The validation and `http(s)` link guards are unchanged and still run
before every write.

## 6. Accessibility

No findings. The failure reaches the same `error` state that `Board.tsx:128-133` already renders,
so the rejecting path inherits the existing announcement rather than adding a new one.

## 7. Consistency with earlier features

- **[Minor]** `R20261001-2` `components/board/useCardMoves.ts:60` — "The move was not saved.
  Please try again." is duplicated from `FAILED.move` (`app/actions/applications.ts:27`). The
  comment justifies the copy because a `"use server"` file can only export async functions. That
  rule constrains what the actions file *exports*, not where the string lives. A constant in a
  `lib/applications/` module, the established home for shared non-React values, could be imported
  by both files. As it stands, the hook's test asserts only `error not.toBeNull()`, so the two
  copies can drift silently, and the design names this as "the one place a drifting string would
  go unnoticed".

## Open questions

- When `revalidatePath` fails after a successful move, the outcome now contradicts the design.
  `design.md` deliberately puts `revalidatePath` outside the `try` so that such a failure "reach[es]
  the error boundary as one rather than be dressed up as a storage failure". On the move path,
  though, the hook's new `catch` (`useCardMoves.ts:52-60`) catches that rejection and shows "The
  move was not saved". The row *was* saved, and the optimistic card unwinds to the old column until
  the next load. I could not establish whether `revalidatePath` can realistically throw at that
  point, so this is not a finding. You may still want the design to say which of the two intents
  governs the move path.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions (shipping does not depend on these)

- `R20261001-1`: the "moved again" test passes whether or not the card was released.
- `R20261001-2`: the duplicated move-failure string could live in `lib/` and be imported by both
  files.
- `R20261001-3`: commit `400d43a` is labelled `docs` but removes the form wrapper's `catch`.
