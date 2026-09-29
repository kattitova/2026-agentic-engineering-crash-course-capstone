# 2026-09-29 — add-application

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review. This is the first review of `add-application`; no earlier review's findings
are the reason this diff exists.
**Reviewed:** `git diff fd839b6..HEAD`, i.e. commits `aa18c7f` through `012436e`:
`lib/applications/validation.ts` + `validation.test.ts`, `lib/applications/action-result.ts`,
`app/actions/applications.ts`, `app/page.tsx`, the new `components/application-form/`
(`AddApplicationDialog.tsx`, `AddApplicationForm.tsx`, `AddApplicationForm.test.tsx`),
`e2e/add-application.spec.ts`, `e2e/reset-board.ts`, `e2e/move-card.spec.ts`, `spec.md`, the
OpenSpec change files, and the author's additions to `docs/reviews/decisions.md`. All source is
committed; the only uncommitted changes are `.agent-log/` and `.claude/` tooling, which are
outside this change.
**Verification run:** `npm run verify` — lint, typecheck and 87 tests in 8 files pass.
`npm run test:e2e` was not run: it builds the app and resets `e2e.db`, a write command. The e2e
spec and `reset-board.ts` were read instead.
**Verdict:** CHANGES REQUESTED — 1 critical, 1 major, 1 minor

## Previously decided — not re-raised

| Closed item | Status in the ledger | What I did |
| --- | --- | --- |
| 2026-09-21 §3/§5 — no maximum field lengths | Deferred (`add-application`) — the condition has arrived | Cashed in and **verified rather than raised**: `validation.ts:27-32,75-125` enforces 120/120/2048/2000 on the trimmed value; both write paths (`createApplication`, `updateApplication`) go through it; `validation.test.ts` fails if any limit is removed or moved to the raw value. No finding. |
| 2026-09-21 §1 — disabled "Add application" button | Declined, "becomes a working control in `add-application`" | Verified: `app/page.tsx:15` now renders the real trigger. |
| 2026-09-21 §2 — commit the proposal before implementation | Deferred (`add-drag-and-drop`), closed | Not re-raised, although the proposal, design and delta spec landed inside `2be48a1`, after `0503f02` had already committed `tasks.md` and code. |
| `R20260927-7` — red-then-green readable from history | Declined | Not re-raised. For the record, this change's history does read red → green. |
| `R20260927-6` — clamp/wrap assertions match class substrings | Open; the author's 2026-09-29 entry declines to take it up here, as board scope | Not re-raised; the author's reasoning (not form scope) holds. |
| All `render-kanban-board`, `harden-kanban-board`, `add-drag-and-drop` fixes | Accepted | Not re-examined; the diff does not touch them beyond moving the e2e reset helper into `e2e/reset-board.ts`, which keeps the same behaviour. |

## 1. Spec compliance

- **[Critical]** `R20260929-1` `app/actions/applications.ts:37` (`prisma.jobApplication.create`,
  no `try`) with `components/application-form/AddApplicationForm.tsx:172-189` — the requirement
  **"A failed write is reported and loses nothing"** is not implemented. `createApplication` lets a
  Prisma error (database locked, unavailable, disk full) escape as a throw, and
  `createApplicationFromForm` passes it straight on. In React 19.2.8 a throwing action marks the
  `useActionState` queue node `rejected` (`react-dom-client.development.js:8448-8461`,
  `onActionError`), and the rejected state is thrown during render to the nearest error boundary.
  That boundary is `app/error.tsx`, which replaces the **whole page**. So for the scenario
  "WHEN the form is submitted and storing the application fails", none of the three THEN clauses
  holds: the form does not stay open (the dialog is unmounted with the page), the values are not
  unchanged (they are gone), and no message says the application was not added. Instead the person
  reads "The board could not be loaded — Your applications are still stored; only this page failed
  to read them", which misreports a failed write as a failed read. What the user loses: everything
  they typed, including up to 2000 characters of notes, plus an accurate account of what happened.
  The form-level `role="alert"` region built for this case (`AddApplicationForm.tsx:188-197`) is
  unreachable in production: every `ok: false` that `createApplication` can return carries a
  non-empty `fieldErrors` (validation fails only when it has set at least one error), so
  `formError` is always `null`. Test weakness under §4 is the same defect and is not counted twice.

The other requirements map to code:

| Requirement / scenario | Satisfied by |
| --- | --- |
| Opening the form; leaving without adding | `AddApplicationDialog.tsx:16-28,54-80` (`showModal`, `onClose`, Cancel); e2e Escape test |
| Exactly four fields, two required | `AddApplicationForm.tsx:199-233`; `AddApplicationForm.test.tsx:42-62` |
| Only required fields → no link, no notes | `validation.ts:43-52` collapses blanks to `null` (existing tests) |
| Appears immediately, in Wishlist, count +1, survives reload | `revalidatePath` in `createApplication`; schema default; `e2e/add-application.spec.ts:86-113` |
| Empty / whitespace / non-http link refused, values kept | native `required` + `validation.ts`; controlled inputs (`AddApplicationForm.tsx:141-145`); component and e2e tests |
| Bounded lengths, enforced in the validator | see the ledger table above |
| Keyboard operable, focus trapped, focus returned | native modal `<dialog>`; `e2e/add-application.spec.ts:141-184` discriminates `show()` from `showModal()` |

Nothing was added beyond the spec.

## 2. AGENTS.md compliance

- **[Minor]** `R20260929-3` commit `012436e` — the message `docs: record the field limits…` has no
  scope, against the `type(scope): short description` rule, and the commit also carries a code
  change (the `use` → `query` parameter rename in `e2e/reset-board.ts:36-40`), mixing a refactor
  into a docs commit.

Otherwise: no `any`; the length logic lives in `lib/applications/validation.ts`; Tailwind only;
no schema change, so no `db push` was needed and the data-model table in `spec.md` was updated;
npm only; the form has component and e2e tests; the validator limits (`aa18c7f` → `b3da29c`) and
the three form behaviours (`30e6d5e` → `2be48a1`, `bcb7b5f` → `aeec526`, `94689ae` → `fd00b7e`)
read red before green. The test edits inside `aeec526` only fill the required fields so the
action can run in jsdom; they do not weaken any assertion.

## 3. Edge cases

- Drag twice / drop into same column / unknown status: not touched by this change.
- Double submit: the submit button is `disabled` while `pending`, which also suppresses implicit
  submission with Enter. No finding.
- Empty, whitespace-only, very long values: handled by the validator and pinned by tests.
- Failed write: see `R20260929-1`.

No further findings. See open questions 1 and 2.

## 4. Test strength

The length tests fail if a limit is deleted, loosened, or measured on the raw value. The
"keeps every value" test fails if the inputs go back to being uncontrolled. The e2e focus trap
test fails under `show()`. These are good tests.

The one gap belongs to `R20260929-1`: `AddApplicationForm.test.tsx:90-101` feeds the form an
`{ ok: false, error }` result without `fieldErrors`, a shape the real action never returns for a
write failure, which throws instead. The test is green against a path that cannot happen in
production. It is reported under `R20260929-1`, not as a separate finding.

## 5. Input safety

No findings. Trimming, required-field checks, the `http(s)`-only link guard and the new maximums
all live in `validateApplicationInput`, which both `createApplication` (and so the form wrapper)
and `updateApplication` call before writing. A `File` from `FormData` is rejected
(`validation.test.ts`, "rejects a File"). `maxLength` on the inputs comes from the same
`APPLICATION_LIMITS` constant and is not relied on. The render path still re-checks the stored
link with `isHttpUrl`. Error messages render as React text.

## 6. Accessibility

- **[Major]** `R20260929-2` `components/application-form/AddApplicationForm.tsx:154-158` — when a
  server-side refusal returns, nothing is announced and focus is not moved. The per-field `<p>` is
  referenced only through `aria-describedby`, which a screen reader reads when the field next gets
  focus, not when the message appears. The `role="alert"` region is used only when there is no field
  error (`:188-189`), and focus stays on the submit button, which is re-enabled. The realistic case
  is a link pasted without a scheme (`jobs.example.com/123`), which passes every native check and is
  refused by the validator. It also covers whitespace-only or over-length values. A screen-reader
  user presses "Add application", hears the button go back to "Add application", and is told nothing:
  the application was not added, and they do not know why. They find out only by tabbing back
  through each field. The proposal promises this ("the message goes next to the field it belongs to
  and **is announced**"), and so do the design's goals ("announced errors"). The spec scenario
  "A field's message is tied to its field" is met literally, which is why this is Major and not
  Critical. The component test pins the description, not an announcement, so it would not catch
  this.

Keyboard operation, the focus trap, focus return, the dialog's accessible name
(`aria-labelledby`), and field labels are all correct and verified by the e2e spec.

## 7. Consistency with earlier features

No findings. `createApplicationFromForm` returns `ActionResult`. `ActionState` is placed next to
`ActionResult` in `lib/applications/action-result.ts`. `APPLICATION_LIMITS` and `FIELD_LABELS`
are exhaustive `Record<keyof ApplicationInput, …>` tables via `satisfies`. The component tests
follow the per-file jsdom docblock and `afterEach(cleanup)` convention, and the e2e reset helper
was extracted rather than duplicated.

## Open questions

1. **Newlines in `notes`.** When a form is submitted, textarea line breaks are serialised as CRLF,
   while `maxLength` on the textarea counts each break as one character. If the server receives
   `\r\n`, a note with N line breaks that the textarea accepts at 2000 characters reaches the
   validator at 2000 + N and is refused with "Notes must be 2000 characters or fewer". It is also
   stored with `\r\n`. I could not check what React's server-action transport delivers without
   running a browser, so this is a question and not a finding.
2. **Dismissing during a pending submission.** Cancel and Escape stay active while `pending`.
   Closing the dialog unmounts the form but does not stop the in-flight action, so the application
   is still stored and appears on the board after the person has "cancelled". Should dismissal be
   blocked while pending, or is this acceptable?

## Blocking follow-ups

1. **Critical** — `R20260929-1`: a failed write throws past the form into `app/error.tsx`. The
   typed values are lost, the dialog disappears, and the message the user sees describes a failed
   read. The requirement "A failed write is reported and loses nothing" is not met, and its test
   exercises a result shape the action never produces.
2. **Major** — `R20260929-2`: a server-side refusal is not announced to assistive technology and
   focus does not move, so a screen-reader user gets no feedback when a submission is refused.

## Non-blocking suggestions (shipping does not depend on these)

- **Minor** — `R20260929-3`: commit `012436e` has no scope in its message and bundles an e2e
  helper rename into a docs commit.
