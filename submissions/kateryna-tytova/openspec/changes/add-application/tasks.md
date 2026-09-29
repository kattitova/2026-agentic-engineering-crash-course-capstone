# Tasks

Test and implementation land as separate commits, red before green, so the order is readable from
history rather than asserted here. A red commit fails `npm run verify` by design.

## 1. Length limits in the validator (TDD)

- [x] 1.1 Extend `lib/applications/validation.test.ts` with a case per field: a value one character
      over the maximum is rejected with an error naming that field, and a value of exactly the
      maximum is accepted. Verify the tests fail, since no length check exists yet (red step)
- [x] 1.2 Add `APPLICATION_LIMITS` (company 120, position 120, link 2048, notes 2000) and enforce
      it in `validateApplicationInput` after trimming, and verify the new tests pass and all
      existing validation tests still do
- [x] 1.3 Verify the limit is applied to the trimmed value, not the raw one, with a test that a
      value padded to over the maximum by whitespace is accepted once trimmed
- [x] 1.4 Run `npm run verify` and confirm lint, typecheck and the unit suite pass

## 2. The form-shaped action

- [x] 2.1 Add `createApplicationFromForm(_prevState, formData)` to `app/actions/applications.ts`,
      reading the four fields and delegating to `createApplication` without coercing them, and
      verify `createApplication`'s own signature and tests are untouched
- [x] 2.2 Verify a `FormData` whose `company` is a `File` rather than text is rejected by the
      existing non-string check, so the wrapper adds no second notion of an empty value

## 3. The dialog and its form (TDD)

- [x] 3.1 Write `components/application-form/AddApplicationForm.test.tsx` asserting the form offers
      exactly the four fields, that company and position are marked required, and that no other
      input is present. Verify it fails because the component does not exist (red step)
- [x] 3.2 Implement `AddApplicationForm` as a client component using `useActionState` over
      `createApplicationFromForm`, with `maxLength` from `APPLICATION_LIMITS`, and verify the tests
      pass
- [x] 3.3 Write a failing test that a field error from the action is rendered next to its field,
      tied to it by `aria-describedby`, and that the field is marked `aria-invalid` (red step);
      then render `fieldErrors` that way and verify it passes
- [x] 3.4 Write a failing test that an error with no field — the write failing outright — is shown
      in a single region above the form rather than beside a field (red step), then implement it
- [x] 3.5 Implement `AddApplicationDialog`: a trigger button and a native `<dialog>` opened with
      `showModal()`, closing on a successful result and staying open otherwise, and verify by hand
      in `npm run dev` that a submission adds a card and the dialog closes
- [x] 3.6 Replace the disabled button in `app/page.tsx` with the dialog's trigger, and verify the
      page is still a Server Component — `next build` must keep reporting `/` as dynamic, not
      static
- [x] 3.7 Run `npm run verify` and confirm it passes

## 4. E2E, in a real browser

These four cannot be asserted in jsdom: it implements `<dialog>` only partly, with no focus trap
and no `::backdrop`.

- [x] 4.1 Add `e2e/add-application.spec.ts` that opens the dialog, fills company and position, and
      verifies a card appears in the Wishlist column and the Wishlist count increases by one
- [x] 4.2 Extend it to reload the page and verify the application is still there, so the test
      distinguishes stored from merely shown
- [x] 4.3 Add a check that submitting with an empty company stores nothing, keeps the dialog open,
      and leaves the position field's value in place
- [x] 4.4 Add a check that focus stays inside the open dialog when tabbing past its last control,
      and returns to the trigger after `Escape`, and verify it fails if the dialog is opened with
      `show()` instead of `showModal()` — the assertion has to distinguish the two
- [x] 4.5 Extend `e2e/move-card.spec.ts`'s reset helper, or the e2e seeder, so a run that adds an
      application leaves the database as it found it, and verify the suite passes twice in a row
      from an already-seeded database
- [x] 4.6 Run `npm run test:e2e` and confirm both the wide and wrapped projects pass

## 5. Documentation and final verification

- [ ] 5.1 Record the four limits in the `spec.md` data model table, and verify the numbers match
      `APPLICATION_LIMITS` exactly rather than being restated by hand
- [ ] 5.2 Add a `spec.md` Spec change log entry recording MVP item 2 as implemented and the
      placeholder "Add application" button as now real, and verify it closes the note the
      board's change left open
- [ ] 5.3 Append to `docs/reviews/decisions.md` that the deferred field-length finding is now
      resolved here, and verify no deferral in the ledger still points at this change
- [ ] 5.4 Run `npm run verify` and `npm run test:e2e` and confirm both pass before marking the
      change complete
