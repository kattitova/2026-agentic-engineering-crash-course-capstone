# 2026-10-01 — edit-and-delete-application (re-review)

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** re-review — the diff exists because of `R20261001-6`, the one blocking finding of
[2026-10-01-edit-and-delete-application.md](2026-10-01-edit-and-delete-application.md); commit
`ba7f067` names it.
**Reviewed:** commits `ba7f067` (`fix(board): keep the edit form open when its row goes out from
under it`) and `c0b4a32` (`docs(openspec): bring design.md back in step with the implementation`),
i.e. `1966d8a..HEAD`. `bac74a5` sits between them and the previous review but touches only review
tooling (`.claude/`, `AGENTS.md`, the propose skill), not this change's code. Nothing relevant is
uncommitted: `git status` shows only `.agent-log/actions.jsonl`.
**Verification run:** `npm run verify` run by me — lint, `tsc --noEmit` and 181 tests in 12 files
pass (179 before, minus the two removed `pending` tests, plus three in `ba7f067` and one in
`c0b4a32`). `npm run test:e2e` **not** run by me: it resets `e2e.db` through
`prisma db push --force-reset`, a write this review may not issue. The new e2e case was read, not
run; nothing below depends on its result.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 1 minor

---

## Previously decided — not re-raised

`docs/reviews/decisions.md` has no entry yet for any `R20261001-6`…`-10` finding, so nothing from
the previous pass is closed by the ledger. The closed items listed in the previous review's table
(`R20260927-6`, `R20260929-3`/`R20261001-3`, the in-flight Cancel/Escape limitation, unbounded field
lengths, `NOT_FOUND` mid-move, the `global-error`/`error.tsx` decisions) are untouched by this diff
and stay closed. The previous review's three open questions are not repeated here.

## Status of previous findings

| ID | Severity | Status | Evidence |
| --- | --- | --- | --- |
| `R20261001-6` | Major | **Fixed** | See below. |

**`R20261001-6` — fixed, and the fix fixes the behaviour, not just the code shape.**

- *Cause removed.* `components/board/Board.tsx:99-105` now holds the `JobApplication` objects in
  `editing`/`deleting` state instead of ids looked up in `shown`. The dialog's open state
  (`Board.tsx:190`, `open={editing !== null}`) no longer depends on the row being in the list, so
  the revalidation issued by the not-found branch can no longer set it to `false`. The only writers
  of `editing` are `openEdit` and `closeEdit`; `closeEdit` is reached from Cancel, the native
  `close` event (Escape/backdrop) and the form's `onSuccess`, which `ApplicationForm.tsx:127` calls
  only on `state.ok`. A not-found result therefore leaves the form mounted with its message.
- *Nothing lost by holding a snapshot.* The claim in the comment holds: `ApplicationForm.tsx:110`
  seeds `values` with `useState(initialValues)`, i.e. once per mount, and `ApplicationDialog.tsx:90`
  keys the form by `editing.id`, which is identical for the old lookup and the new snapshot. The
  previous design never re-read the looked-up row either, so no freshness was traded away.
- *Test would catch a regression.* `Board.test.tsx` "keeps the form open with the message when the
  row disappears under it" re-renders `Board` with the row removed after the not-found result —
  exactly the step that tore the form down. Against the previous `byId` lookup `editing` becomes
  `null`, the form unmounts and `getByText("Application not found")` throws, so the test fails on
  the defect and passes on the fix; the commit message reports it was reproduced red first. It also
  asserts the card is gone, the other half of the requirement. "closes only when the person
  dismisses it" pins that the dialog still closes on Cancel, so the fix cannot have been achieved by
  a dialog that never closes.
- *End to end.* `e2e/edit-and-delete.spec.ts` gained "says the application was not found when the
  row went while the form was open": deletes the row from `e2e.db` behind the open form, submits,
  and asserts the dialog is visible, the message is visible inside it, the card is gone without a
  reload, Escape closes it, and no row was written back. Read, not run (see Verification).

## Regressions introduced by the fixes

None found. What I checked:

- **Confirmation dialog now holds a snapshot too.** If the row is deleted elsewhere while the
  confirmation is open, the confirmation now stays open instead of vanishing. Confirming then calls
  `removeCard`, the action returns `NOT_FOUND` and revalidates — the path the `application-delete`
  requirement "Deleting an application that is already gone is reported as such" already describes.
  No spec scenario asks the confirmation to close on its own when the row vanishes; the earlier
  test "closes the confirmation rather than leaving it naming a card that is gone" still passes,
  because `confirmDelete` clears `deleting` before `removeCard` (`Board.tsx:111-117`), unchanged.
- **Removing `pending` from `ConfirmDeleteDialog`.** The requirement "A deletion in flight cannot be
  started again" is still met — by the confirmation being closed and the card optimistically removed
  — and is now pinned where it lives: `Board.test.tsx` "offers no way to confirm the same deletion
  twice" defers the deletion, asserts neither the confirmation heading nor the card's delete control
  exists while it is in flight, and asserts `deleteApplication` was called once. No caller of the
  removed prop remains (`grep` for `pending=` and `isMovePending` in production code: none).
- **Rename `isMovePending` → `isCardBusy`** through `BoardColumn`, `DraggableCard` and
  `ApplicationCard` is mechanical; the `useDraggable({ disabled })`, the handle's `disabled` and the
  focus-restore effect all read the renamed prop, and `tsc` passes.
- **Focus outline classes** on the card controls and the confirmation buttons are additive
  `focus-visible:` utilities; they change no geometry at rest, so the measured long-value layout is
  not affected.
- **`c0b4a32`** adds one `Board.test.tsx` case ("leaves the card movable again after a failed
  deletion") and edits `design.md`; no production code.

## New Critical or Major defects inside the fix diff

None.

## Carried forward — non-blocking, shipping does not depend on it

- **[Minor]** `R20261001-10` — commit `1966d8a` bundles production fixes, the e2e harness rework,
  the new spec and the `spec.md` entries under a `test(e2e)` type. History is not rewritten, so it
  stands as recorded; carried forward unchanged.

The other earlier Minor items were addressed in `ba7f067` and I confirmed it while checking for
regressions: `R20261001-7` (unreachable `pending` prop and its two tests — removed),
`R20261001-8` (focus indicator — now an outline, not a tint alone), `R20261001-9` (predicate name —
renamed through to the card; a test comment at `useBoardCards.test.ts:235` still says
`isMovePending`, which is residue of the same finding, not a new one). The previous review's Note on
the hook test title is likewise addressed by the retitle.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions — shipping does not depend on any of these

- `R20261001-10` — carried forward unchanged (see above).
