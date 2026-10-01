# Tasks

Business logic — the actions, the form wrapper and the optimistic reducer — is written red-first per
`AGENTS.md`: the task that writes the test says "(red)" and is a separate task from the one that
makes it pass. UI interaction tasks state the assertion the test must make; the component and its
test land together.

Two scenarios have no task on purpose, and both are named in `design.md` under "What the native
`<dialog>` covers": "Focus does not escape the open form" and "Focus does not escape the
confirmation" are the browser's focus trap, which jsdom does not implement. They are covered by the
e2e run in 7.5, not by a unit test.

## 1. Renames, as their own commits

- [x] 1.1 Rename `useCardMoves` to `useBoardCards` (hook, `useCardMoves.ts`, `useCardMoves.test.ts`)
      with no behaviour change, and verify `npm run verify` passes with the move tests unchanged in
      substance
- [x] 1.2 Rename `AddApplicationForm` to `ApplicationForm` and `AddApplicationDialog` to
      `ApplicationDialog` (files, tests, and the import where the dialog is mounted) with no
      behaviour change, and verify `npm run verify` passes
- [x] 1.3 Commit 1.1 and 1.2 separately as `refactor(board): …` and `refactor(application-form): …`,
      and verify `git log --stat` shows each rename alone with no feature code in it

## 2. The write path: what it writes, and what it says when the row is gone

- [x] 2.1 Pin that `updateApplication` passes Prisma exactly `{ company, position, link, notes }` as
      `data` — no `status`, no `appliedDate`, no `statusChangedAt`. Verify the test asserts the key
      set, not only the values. **Not red-first, and it cannot be:** `data` is whatever
      `validateApplicationInput` returned, which is exactly those four fields, so the guarantee
      already holds by construction and the test is a regression guard. `AGENTS.md` asks red-first
      for new business logic; this is pre-existing logic being pinned
- [x] 2.2 Covered by 2.1 — there is no separate green step, because there was no red
- [x] 2.3 Write failing tests (red) asserting that `updateApplication` and `deleteApplication` call
      `revalidatePath` on their not-found branch, and verify both fail before the actions change
- [x] 2.4 Add `revalidatePath(BOARD_PATH)` to the not-found branch of both actions, matching
      `updateApplicationStatus`, and verify the tests from 2.3 pass
- [x] 2.5 Write failing tests (red) for `updateApplicationFromForm(prevState, formData)`: a valid
      edit reaches `updateApplication` with the form's values and the hidden id; a refused edit comes
      back with field errors and writes nothing; a missing, empty or non-string id returns
      `INVALID_ID`; an application that no longer exists comes back as not found and **not** as the
      unclassifiable-failure message
- [x] 2.6 Add `updateApplicationFromForm` reading `id`, `company`, `position`, `link` and `notes`
      from the form data, and verify the tests from 2.5 pass

## 3. One optimistic list for moves and deletions

- [x] 3.1 Write failing tests (red) in `useBoardCards.test.ts` for the deletion path: a confirmed
      deletion removes the card from `shown`; a failed deletion restores it and sets `error`; a
      not-found deletion sets the not-found message and does **not** restore the card; the card is
      held while its deletion is in flight and other cards are not; a later success clears `error`
- [x] 3.2 Introduce the `BoardChange` discriminated change and the single reducer over
      `useOptimistic` (`move` re-statuses, `remove` filters out), add `removeCard`, rename the
      predicate `isMovePending` to `isCardBusy`, and verify the tests from 3.1 and every existing
      move test pass
- [x] 3.3 Write a test that issues a move and a deletion of the same card in one session, and verify
      `shown` and the pending set are left consistent and no card is resurrected

## 4. The form serves editing

- [ ] 4.1 Give `ApplicationForm` an `initialValues` prop (defaulting to empty), an optional `id`
      prop rendered as a hidden `id` field only when present, and a submit label. Verify tests
      assert the four fields open pre-filled from `initialValues`, that an application with no link
      and no notes opens with those two fields empty, and that no hidden id field is rendered in add
      mode
- [ ] 4.2 Verify with tests that an edit refused for a cleared company, a non-http link and an
      over-maximum company keeps what the person typed — not the stored values — shows the field
      message, and moves focus to the first field at fault, the same assertions add mode makes
- [ ] 4.3 Verify with a test that a failed edit (the action returns `{ ok: false, error }` with no
      field) leaves the form open with its values and renders the message in the single alert region
- [ ] 4.4 Verify with a test that submitting again after a failed edit calls the action a second
      time with the same values, so "The submission can be retried" is checked and not assumed
- [ ] 4.5 Verify with a test that an edit reported as not found renders that message rather than the
      "was not updated" message, so the two failure kinds are distinguishable to the person
- [ ] 4.6 Let `ApplicationDialog` be opened on an existing application: an `application` prop that
      selects the edit action, the edit heading, the id passed to the form and the pre-filled values.
      Verify with tests that it closes on success, that dismissing it leaves the application
      unchanged, and that opening it on a second application shows none of the first one's values

## 5. Card controls

- [ ] 5.1 Add `onEdit` and `onDelete` callbacks to `ApplicationCard` as two controls in a `shrink-0`
      group beside the drag handle, each with an `aria-label` naming the application, and verify
      `ApplicationCard.test.tsx` asserts both are controls, are named per application, and that
      activating one does not fire the drag handle's listeners
- [ ] 5.2 Verify with a test that a card whose stored link has been cleared renders no link control
      while still rendering both new controls, covering "Clearing an optional value" at the card
- [ ] 5.3 Thread the callbacks through `BoardColumn` and `DraggableCard`, and verify
      `BoardColumn.test.tsx` asserts each card's controls call back with that card's id
- [ ] 5.4 Run `npm run test:e2e -- long-value-layout` and verify a 200-character company name still
      does not widen its column in either viewport with the two extra controls present

## 6. Deletion, confirmed

- [ ] 6.1 Add `ConfirmDeleteDialog` on the `showModal()` pattern, naming the application in a
      heading the dialog is labelled by, with a confirm and a decline control. Verify tests assert
      that it is announced with the application's name, that declining deletes nothing and returns
      focus to the control that opened it, and that the confirm control is disabled while the
      deletion is in flight
- [ ] 6.2 Wire `Board` to hold `editingId` and `deletingId`, render one `ApplicationDialog` and one
      `ConfirmDeleteDialog`, and route deletion failures into the existing assertive alert region.
      Verify a test asserts a failed deletion shows the message on the board while the board itself
      is still rendered
- [ ] 6.3 Verify with a test that a second failed deletion, of a different card, replaces the first
      message and is announced rather than being taken for the first, covering "One failure does not
      hide the next"
- [ ] 6.4 Verify with a test that a confirmed deletion removes the card and decreases that column's
      count, and that every other card stays in its own column

## 7. End to end and record-keeping

- [ ] 7.1 Add an e2e spec that edits an application from its card, reloads, and verifies the card
      shows the edited values, is still in its original column with the counts unchanged, and that
      no second card was created
- [ ] 7.2 Add an e2e spec that clears a stored link through the edit form, reloads, and verifies the
      card offers no posting link
- [ ] 7.3 Add an e2e spec that deletes an application through the confirmation, reloads, and
      verifies the card is gone and the column count has dropped; verify the spec cleans up after
      itself the way `long-value-layout.spec.ts` does
- [ ] 7.4 Add an e2e spec that declines the confirmation and verifies the card is still there after a
      reload
- [ ] 7.5 Add an e2e spec that tabs past the last control of the open edit form and of the open
      confirmation, and verifies focus stays inside each — the two scenarios jsdom cannot cover
- [ ] 7.6 Add the `spec.md` change-log entry recording that editing deliberately leaves `status`,
      `appliedDate` and `statusChangedAt` alone, and that deletion is final with no undo in the MVP.
      Verify the entry is dated and names this change
- [ ] 7.7 Run `npm run verify` and the full `npm run test:e2e`, and verify both pass with no errors
- [ ] 7.8 Request a review pass from a separate agent session against this change, and verify the
      outcome is recorded under `docs/reviews/` and indexed in `docs/review-log.md`
