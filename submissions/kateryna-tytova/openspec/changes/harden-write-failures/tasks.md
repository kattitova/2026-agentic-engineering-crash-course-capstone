# Tasks

Test and implementation land as separate commits, red before green, so the order is readable from
history rather than asserted here. A red commit fails `npm run verify` by design.

## 1. Reproduce the defect before fixing it

- [x] 1.1 Extend `components/board/useCardMoves.test.ts` with a case where the mocked
      `updateApplicationStatus` rejects, asserting that the hook reports the failure and that
      `isMovePending` goes back to false for that card. Verify it fails, and record how — an
      unhandled rejection, not a wrong value, is the shape this defect has (red step)
- [x] 1.2 Extend `app/actions/applications.test.ts` with a rejecting Prisma call per action —
      `createApplication`, `updateApplicationStatus`, `updateApplication`, `deleteApplication` —
      asserting each returns `{ ok: false }` rather than rejecting. Verify all four fail (red step)
- [x] 1.3 Verify the existing tests for `updateApplication` and `deleteApplication` still pass at
      this point, so the red is about the uncaught case and not about the `P2025` path

## 2. Make the actions keep the promise `ActionResult` makes

- [x] 2.1 Add a catch-all to `createApplication` returning `{ ok: false, error }`, and verify its
      existing tests are untouched and still pass
- [x] 2.2 Add one to `updateApplicationStatus` around the transaction, and verify the "application
      not found" branch still returns `NOT_FOUND` and still revalidates
- [x] 2.3 Replace the `throw error` in `updateApplication` and in `deleteApplication` with the same
      catch-all, and verify `isRecordNotFound` still wins for `P2025` so the specific message is not
      swallowed by the general one
- [x] 2.4 Verify each action returns the exact message `design.md` fixes for it, asserting the whole
      string rather than a substring, so the underlying error's text cannot leak into it. For
      `createApplication` the string is already pinned by `app/actions/applications.test.ts`; verify
      that existing assertion passes unchanged rather than writing a second one beside it
- [x] 2.5 Add `console.error` for the caught error, and verify the four new tests pass and nothing
      that passed before now fails

## 3. Leave the board usable

- [ ] 3.1 Move the release of the pending card in `useCardMoves` into a `finally`, and verify the
      red test from 1.1 passes
- [ ] 3.2 Verify the card can be moved again after a failed move, with a test that moves the same
      card twice and asserts the second attempt reaches the action — the scenario the delta spec
      adds, and the half of the defect that a returned result alone does not fix
- [ ] 3.3 Verify by mutation that 3.1 is load-bearing: restore the release to its old position and
      confirm 1.1 and 3.2 fail, then put it back

## 4. Let Next's own throws through

- [ ] 4.1 Write a failing test that an action which throws a Next control-flow error — the shape
      `redirect()` produces — rejects rather than returning `{ ok: false }`. Verify it fails against
      the catch-alls from group 2, which is the trap being guarded (red step)
- [ ] 4.2 Add `unstable_rethrow(error)` as the first line of every catch, and verify the test passes
      and all four unclassified-failure tests from 1.2 still do
- [ ] 4.3 Verify the guard is load-bearing by mutation: remove one `unstable_rethrow` and confirm
      4.1 fails, then put it back

## 5. Remove what the guarantee makes dead

- [ ] 5.1 Remove the `try`/`catch` from `createApplicationFromForm`, and verify its existing
      "reports a failed write instead of throwing past the form" test still passes — now because
      `createApplication` returns the failure rather than because the wrapper caught it
- [ ] 5.2 Verify the whole form path still holds end to end by running `npm run test:e2e`, since
      the wrapper is what `e2e/add-application.spec.ts` exercises

## 6. Documentation and final verification

- [ ] 6.1 Record in the `spec.md` Spec change log that the convention is now carried by the
      functions rather than only stated, and verify the existing 2026-09-27 entry that states it is
      updated rather than contradicted
- [ ] 6.2 Append to `docs/reviews/decisions.md` that the `R20260929-1` class of defect is closed
      across every write path, naming the three sites the review did not see, and verify no entry
      still describes the convention as unenforced
- [ ] 6.3 Run `npm run verify` and `npm run test:e2e` and confirm both pass before marking the
      change complete
