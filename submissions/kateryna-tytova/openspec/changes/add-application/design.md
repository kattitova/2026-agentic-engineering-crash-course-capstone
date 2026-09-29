# Design

## Context

See proposal.md — Why.

What already exists and shapes the approach:

- `createApplication(input)` validates through `validateApplicationInput`, writes, calls
  `revalidatePath("/")` and returns `ActionResult<JobApplication>`. It has never had a caller.
- `ActionResult` already carries `fieldErrors?: ValidationErrors`, keyed by field name. Nothing has
  ever rendered them.
- `validateApplicationInput` trims, rejects empty and whitespace-only `company`/`position`,
  collapses blank `link`/`notes` to `null`, and restricts `link` to `http:`/`https:` via
  `isHttpUrl`. It has no length checks.
- `Board` is the one client component. `app/page.tsx` stays a Server Component and holds the
  disabled "Add application" button.
- `npm run verify` is lint + typecheck + unit tests; component tests opt into jsdom per file with a
  `// @vitest-environment jsdom` docblock, and each calls `afterEach(cleanup)` itself.
- Next's forms guide requires `(prevState, formData)` for a function driven by `useActionState`.

## Goals / Non-Goals

**Goals:**

- Keep `createApplication` and its tests exactly as they are.
- Put the length limits where both write paths already meet, not in the form.
- Reach the accessibility bar the board already holds: named controls, announced errors, keyboard
  operation, focus that goes somewhere sensible.

**Non-Goals:**

- Editing or deleting. MVP item 4.
- A status picker or an application date on the form.
- A validation library. The project validates by hand and the rules are small; adding one now would
  be a second way to express the same constraints.

## Decisions

### Length limits live in `validateApplicationInput`, not in the schema

`company` 120, `position` 120, `link` 2048, `notes` 2000, exported as named constants so the form's
`maxLength` attributes and the tests read the same numbers.

Alternative considered: `@db.VarChar(n)` in `prisma/schema.prisma`. Rejected, and not merely for
convenience — SQLite ignores length on `VARCHAR`, so the schema would state a constraint the
database does not apply, and `AGENTS.md` makes `schema.prisma` the source of truth for the model.
Better to have one enforcement point that really enforces.

`maxLength` on the inputs stops most over-typing, but it is a convenience: it is absent from a
paste in some browsers, and it does not exist at all for `prisma/seed.ts` or a direct call. The
validator is the guard, which is why the requirement says "where the application is validated".

### A form-shaped action wraps the existing one

`createApplicationFromForm(_prevState, formData)` is added to `app/actions/applications.ts`. It
reads the four fields out of `FormData` and calls `createApplication`.

Alternative considered: changing `createApplication` to take `(prevState, formData)`. Rejected —
it would put a transport concern into the action the rest of the app calls, and it would rewrite
tests that currently describe the domain behaviour rather than the form.

`FormData.get` returns `string | File | null`. The wrapper passes the values through untouched and
lets `validateApplicationInput` decide, because it already rejects a non-string and that is exactly
what a `File` would be. No pre-coercion, so there is no second place where "what counts as empty"
is decided.

### A native `<dialog>`, not a hand-built modal

`showModal()` gives the focus trap, `Escape`, the inert background and the backdrop without any of
it being written here. The requirement "focus stays within the form" is then the browser's
behaviour rather than a keydown handler to get wrong.

Alternative considered: a positioned `<div>` with `role="dialog"` and a focus-trap effect.
Rejected — it is more code for the same result, and every hand-rolled trap in this position is a
place where a future control gets missed.

Focus returning to the trigger is also `<dialog>`'s own behaviour when it is closed, so the
requirement needs no extra work; the tasks verify it rather than implement it.

### The form is a client component; the page stays a Server Component

`app/page.tsx` renders `<AddApplicationDialog />` in place of the disabled button. The dialog owns
its open state, the `useActionState` call and the `<dialog>` ref. The board is untouched: a new
application reaches it through `revalidatePath("/")`, which `createApplication` already calls.

No optimistic insert. Unlike a move, there is no card on screen to leave stale, and the person is
looking at a form rather than at the board — a revalidated render is fast enough to be the
simplest correct answer.

### The form closes on success, and only on success

`useActionState` returns the last result. When it turns `ok`, the dialog closes and the form
resets; on failure it stays open with everything typed still in the fields.

Keeping the values is not extra work but the absence of it: an uncontrolled form whose DOM nodes
are never unmounted keeps what was typed. The mistake to avoid is closing the dialog first and
reopening it on failure, which is what loses the input.

### Errors are rendered per field, from `fieldErrors`

Each input is tied to its message with `aria-describedby` and marked `aria-invalid` when it has
one, so a screen reader reads the message as part of that field. A message with no field — the
write failing outright — goes to one region above the form.

This is the shape `ActionResult` was given on day one and never used; it needs no new convention.

## Risks / Trade-offs

- **`<dialog>` needs JavaScript, so the form does not work without it** → accepted. The board
  already requires JavaScript for drag-and-drop, and nothing else in the project degrades. A
  progressively-enhanced form would mean a separate route, which was considered and set aside when
  the dialog was chosen.
- **jsdom implements `<dialog>` only partly** → `showModal` exists in recent jsdom but the focus
  trap and `::backdrop` do not. Component tests therefore assert what is rendered and how fields
  and messages are tied together; the trap and the focus return are e2e assertions, in a real
  browser, for the same reason the board's accessibility-tree check had to be.
- **120 characters will be too short for some company name** → accepted, with the recorded reason
  that a limit is a guard rather than a guess at the longest real value. Raising a number in one
  constant is a small change if it ever bites.
- **Two write paths for one concept** (`createApplication` and its form wrapper) → the wrapper has
  no logic of its own beyond reading four keys, and the tests cover the shared validator, so the
  duplication is a signature and not a rule.

## Open Questions

None. The three that would have changed the shape of this work — where the form lives, what the
limits are, and whether the column can be chosen — were settled before the change was written: a
dialog over the board, 120/120/2048/2000, and no status picker.
