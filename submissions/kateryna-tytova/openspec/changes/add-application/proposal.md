# Proposal

## Why

The board can show applications and move them between columns, but nothing can put an application
on it. Every card in `dev.db` got there through `prisma/seed.ts` or a hand edit, which is the
friction the tool exists to remove. This is MVP item 2, and the header has carried a disabled "Add
application" button since the board landed — recorded in the `spec.md` Spec change log as a
deliberate placeholder for this change.

It also closes the last unresolved Major from the 2026-09-21 review. Nothing bounds `company`,
`position`, `link` or `notes` today. That was deferred here on the grounds that no gap was open
while `createApplication` had no caller — this change gives it one, so the limits land with it.

## What Changes

**A form adds an application.** The "Add application" button opens a dialog over the board with
four fields: company and position required, link and notes optional. Submitting stores the
application and it appears on the board without a reload. The dialog closes on success and stays
open with the message when the write fails, so nothing typed is lost.

**A new application starts in Wishlist.** There is no status picker: the form matches the four
fields `spec.md` names for MVP item 2, and moving the card is what drag-and-drop is for.

**Field lengths are bounded.** `company` and `position` at 120 characters, `link` at 2048, `notes`
at 2000. 2048 is the conventional URL ceiling, and the shorter limits a job board's tracking
parameters would not survive. The limits are enforced in `validateApplicationInput`, which both
write paths already share, and recorded in the `spec.md` data model as `AGENTS.md` requires.
`maxLength` on the inputs is a convenience, never the guard.

**Validation failures are shown per field.** `createApplication` already returns
`fieldErrors` keyed by field name; nothing rendered them until now. The message goes next to the
field it belongs to and is announced, rather than appearing as one line at the top.

Not in this change:

- Editing and deleting an application. MVP item 4, and a separate change.
- Choosing the column, or setting the application date, when adding. Both would go beyond the four
  fields `spec.md` lists.
- A maximum length on any field that the form does not write.

## Capabilities

### New Capabilities

- `application-form`: adding a job application through the interface — the fields, what is
  required, what is rejected, and what the person sees when a write fails.

### Modified Capabilities

<!-- None: the board's display and move requirements are unchanged. A new application
     simply appears in Wishlist, which the existing kanban-board requirements already cover. -->

## Impact

- **Code**: new `components/application-form/` (a dialog and its form); `app/page.tsx` replaces the
  disabled button with the real trigger; `lib/applications/validation.ts` gains the length checks;
  `app/actions/applications.ts` gains a form-shaped entry point beside the existing
  `createApplication`.
- **Server actions**: `createApplication` keeps its signature and its tests. `useActionState`
  requires `(prevState, formData)`, so the form calls a thin wrapper that parses `FormData` and
  delegates, rather than reshaping the action the board already relies on.
- **Data**: no schema change and no migration. The limits are validation, not column types —
  SQLite would not enforce a `VARCHAR(n)` anyway, so putting them in the schema would describe a
  constraint that does not exist.
- **Dependencies**: none added.
- **Tests**: length limits follow the existing validation tests; the dialog and the field errors
  get component tests; the e2e suite gains a spec that adds an application and finds it on the
  board after a reload.
- **Docs**: the `spec.md` data model records the four limits, and the Spec change log records that
  MVP item 2 is implemented and the placeholder button is now real.
