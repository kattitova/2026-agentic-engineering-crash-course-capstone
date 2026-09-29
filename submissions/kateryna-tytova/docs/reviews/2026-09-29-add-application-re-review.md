# 2026-09-29 — add-application (re-review)

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** re-review. The commits after `012436e` exist because of the blocking findings in
[2026-09-29-add-application.md](2026-09-29-add-application.md) (`R20260929-1` Critical,
`R20260929-2` Major). Scope is limited to those findings, regressions caused by the fixes, and
new Critical/Major defects inside the fix diff.
**Reviewed:** `git diff 012436e..HEAD`, i.e. commits `755b6c3`, `555f49e`, `52e9914` (the two
blocking fixes), `1741dba`, `4d3c34c` (the line-break fix for open question 1), `d7bcd18`,
`ced5ec4`, `b2cf24c` (docs, ledger, OpenSpec artifacts). Files: `app/actions/applications.ts`
and its new test, `components/application-form/AddApplicationForm.tsx` and its test,
`lib/applications/validation.ts` and its test, `e2e/add-application.spec.ts`, `spec.md`, the
change's `design.md`, `tasks.md` and delta spec. All source is committed. The only uncommitted
changes are `.agent-log/` and `.claude/` tooling, which are outside this change.
**Verification run:** `npm run verify`: lint, typecheck and 94 tests in 9 files pass (up from
87 in 8). I did not run `npm run test:e2e`, because it rebuilds the app and resets `e2e.db`,
which is a write. I read the new e2e tests instead.
**Verdict:** PASS — 0 critical, 0 major, 0 minor

## Previously decided — not re-raised

| Closed item | Status in the ledger | What I did |
| --- | --- | --- |
| `R20260929-3`: commit `012436e` has no scope and bundles a rename | Accepted, not rewritten | Not re-raised, and not carried forward as a Minor, because the ledger closes it. |
| Open question 1 (2026-09-29): CRLF in `notes` | Resolved as a defect and fixed | Checked only for regressions (see below). |
| Open question 2 (2026-09-29): dismissal while a submission is pending | Accepted as a recorded limitation, `spec.md` change log | Not re-raised. |
| `R20260927-6`: clamp/wrap assertions match class substrings | Open, and explicitly declined as out of this change's scope | Not re-raised. It belongs to the board, and this diff does not touch the board. |
| Everything from `render-kanban-board`, `harden-kanban-board`, `add-drag-and-drop` | Accepted / Deferred / Declined | Not re-examined. The fix diff does not touch those files. |

## Status of previous findings

| ID | Status | Evidence |
| --- | --- | --- |
| `R20260929-1` (Critical): a failed write throws past the form into `app/error.tsx` | **Fixed** | `app/actions/applications.ts:54-67` wraps `createApplication` in `try`/`catch`. A rejected `prisma.jobApplication.create` now comes back as `{ ok: false, error: "The application was not added. Please try again." }` with no `fieldErrors`. I traced it through to the behaviour: `AddApplicationForm.tsx:117-118` sets `formError` exactly when `fieldErrors` is empty, so the `role="alert"` paragraph (`:122-126`) renders. That region was unreachable before and is reachable now. `onSuccess` is not called, so the dialog stays open. The inputs are controlled (`:61`), so the values survive. All three THEN clauses of "A failed write is reported and loses nothing" hold. The new `app/actions/applications.test.ts` mocks a rejecting `create` and asserts the result shape. It was committed red in `755b6c3`, before the fix in `52e9914`, and it fails if the `catch` is removed. The existing component test that feeds `{ ok: false, error }` now exercises a shape the action really produces, so the test-strength half of the finding is also closed. |
| `R20260929-2` (Major): a server-side refusal is not announced | **Fixed** | `AddApplicationForm.tsx:98-112`: on every non-ok result, the effect focuses `querySelector('[aria-invalid="true"]')` inside the form. I checked that the selector hits the right element. `aria-invalid` is spread onto the `<input>`/`<textarea>` itself (`:56`, `:70`), not onto the wrapper `div`, so the focused element is the control. That control carries `aria-describedby` to its message, so its label, its invalid state and the message are read together. The effect runs after commit, when the attributes from the same render are already in the DOM. `state` is a new object for each submission, so a second identical refusal moves focus again. `querySelector` returns the first match in document order. The case in the finding, a scheme-less link refused only by the server, now lands focus on Link with "Link must be a valid http(s) URL". `555f49e` (red) precedes `52e9914` (green). The new test fails if the focus call is removed, and a second test pins that focus is left alone on success. |

## Regressions

None found.

- `normaliseNewlines` (`validation.ts:40-42`) runs before `trim()` in both `requiredText` and
  `optionalText`, so the length limits are now measured on the normalised value. That is the
  intended change. It also affects `updateApplication`, which shares the validator, and only by
  storing `\n` instead of `\r\n`. The `http(s)` link guard and the length guard are unchanged, and
  both still run on every write path.
- The `catch` in `createApplicationFromForm` does not wrap `createApplication` itself, so
  `createApplication`'s existing callers and tests are unaffected. Validation failures still
  return per field without touching the database, and a test in the new file pins this.
- The effect's early `return` on success keeps the previous `onSuccess` behaviour, and the
  existing close-on-success tests still pass.
- No new Critical or Major defect inside the fix diff.

## Blocking follow-ups

None. This change is clear to ship.

## Non-blocking suggestions (shipping does not depend on these)

None carried forward. The earlier review's only Minor (`R20260929-3`) is closed in the ledger.
