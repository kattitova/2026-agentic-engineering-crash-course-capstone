# 2026-10-01 — edit-and-delete-application

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review
**Reviewed:** commits `575fe58..1966d8a` (eight commits, `575fe58~1..HEAD` on branch `kateryna-tytova`),
against `openspec/changes/edit-and-delete-application/{proposal,design,tasks}.md`, the three delta
specs under that change's `specs/`, `openspec/specs/{application-form,kanban-board}/spec.md`,
`spec.md` (MVP item 4 and the Spec change log) and `AGENTS.md`. Nothing relevant is uncommitted:
`git status` shows only agent-tooling files outside this change.
**Verification run:** `npm run verify` run by me — lint, `tsc --noEmit` and 179 tests in 12 files all
pass. `npm run test:e2e` **not** run by me: it rebuilds the app and resets `e2e.db` through
`prisma db push --force-reset`, which is a write command this review may not issue. The author
reports 46 e2e tests passing; findings below never rest on an e2e result I could not see, and where
one would settle a question I say so.
**Verdict:** CHANGES REQUESTED — 0 critical, 1 major, 5 minor

Finding IDs continue from `R20261001-5` rather than restarting at 1, because two reviews already
issued IDs under today's date (`harden-write-failures`, `measure-long-value-layout`) and an ID is
never reused.

---

## Previously decided — not re-raised

| Closed item | Disposition | Why it is not a finding here |
| --- | --- | --- |
| `R20260927-6` — clamp/wrap assertions match class substrings | Closed 2026-10-01 in `measure-long-value-layout` | The substring assertions are gone and `e2e/long-value-layout.spec.ts` measures. This change adds two controls to the measured card header; task 5.4 records the measured run. Not re-opened. |
| `R20260929-3`, `R20261001-3` — commit type/scope hygiene on named past commits | Accepted, not rewritten | Those commits stay as they are. `R20261001-10` below is a **new** commit in this diff, not those. |
| 2026-09-29 Open question 2 — Cancel/Escape stay active while a submission is in flight | Accepted as a recorded limitation | Applies unchanged to the edit form. The disposition's remark that "undoing it belongs to MVP item 4, which brings delete" is satisfied by this change: a row stored by a dismissed submission can now be deleted. |
| 2026-09-21 §3/§5 — unbounded field lengths | Resolved in `add-application` | The edit path reaches the same `validateApplicationInput` and the same `APPLICATION_LIMITS`; verified below under §5. |
| 2026-09-27 §3 — what `NOT_FOUND` does to the board mid-move | Cashed in `add-drag-and-drop` | The `notFound()` helper now serves all three actions. Not re-raised; the new half of it is covered by `R20261001-6`. |
| 2026-10-01 — `app/global-error.tsx`, narrowing `app/error.tsx`, its "failed to read them" wording | Recorded decisions, not open findings | Untouched by this diff. |

No deferral names `edit-and-delete-application` as its condition, so there is nothing to cash in.

---

## 1. Spec compliance

I mapped every scenario in the three delta specs to the code and the test that holds it. All but one
are implemented, and all but one are covered by a test at some level. The exception is the first
finding.

**`application-delete` — 17 scenarios.** All implemented. Confirmation before any write
(`Board.tsx:98-111`, `ConfirmDeleteDialog.tsx`), optimistic removal plus column count
(`useBoardCards.ts:28-37`), failure reported in the board's assertive region, card restored because
the server list is what the board falls back to, the not-found branch deliberately not restoring,
keyboard operation and the native focus trap. Nothing in the delta is unimplemented.

**`kanban-board` — 8 scenarios.** All implemented: two named per-application controls in a
`shrink-0` group (`ApplicationCard.tsx:98-131`), neither acting as a drag source, failures routed to
the form when the form is open and to the board when it is not.

**`application-form` — 29 scenarios across 5 modified and 3 added requirements.** One is not
delivered to the person:

- **[Major]** `R20261001-6` `components/board/Board.tsx:84-97` and `:180` (with
  `components/application-form/ApplicationDialog.tsx:84-100`) — **an edit of an application that no
  longer exists closes the form and takes its "Application not found" message with it, so the
  person is told nothing.** The board derives the dialog's open state from the row's presence in the
  shown list: `editing = shown.find(card => card.id === editingId)` and
  `<ApplicationDialog open={editing !== null} …>`; the form itself is mounted only while open
  (`ApplicationDialog.tsx:84`). The not-found branch of `updateApplication` calls
  `revalidatePath("/")` before returning (`app/actions/applications.ts:27-29`, `:155`) — which is
  exactly what removes that row from `applications`, hence from `shown`, hence sets `editing` to
  `null`, hence closes the dialog and unmounts the form holding the message. The requirement
  "Editing an application that no longer exists is reported as such" asks for the opposite: "the
  form SHALL say that the application was not found", and its second scenario asks that the message
  be distinguishable from the unclassifiable-failure message. What the person actually gets is a
  dialog that closes and a card that disappears — which is pixel-for-pixel what a **successful**
  save looks like, except the card is gone instead of updated. They cannot tell "saved" from
  "somebody deleted this".
  What I verified by reading, and what I did not: the teardown is unconditional and the revalidation
  that triggers it is issued by the same branch that produces the message, so the message cannot
  outlive the row — that part is not a guess. What I could not run is the frame-level ordering, i.e.
  whether the message flashes for one commit before the dialog closes. Either way it is not
  readable, and nothing pins it: `ApplicationForm.test.tsx:…` ("says the application was not found
  rather than that the storage failed") renders the form in isolation, where no board can close it,
  and `Board.test.tsx` has no not-found edit case. A board-level test that re-renders with the row
  removed, or an e2e case that deletes the row from `e2e.db` while the form is open, would settle it
  in either direction. Cross-referenced under §4 rather than counted twice.

**Code without a requirement behind it:** none found. `AddApplicationButton.tsx` is the previous
`AddApplicationDialog` trigger split out so the dialog can be controlled by the board — same
behaviour, same requirement. The `spec.md` change log gained the three entries the proposal promised
(editing leaves `status`/`appliedDate`/`statusChangedAt`; deletion is final with no undo; the two
actions now revalidate on not-found), so no behaviour in the diff is outside `spec.md`.

## 2. AGENTS.md compliance

- TypeScript strict, no `any`: `grep -rn '\bany\b'` over `app`, `components`, `lib`, `e2e`,
  `scripts` returns only generated Prisma sources and one occurrence of the English word in a
  comment. `tsc --noEmit` is clean.
- Testable logic outside JSX: the optimistic reducer and the pending set are in
  `components/board/useBoardCards.ts`, the id check and validation in `app/actions/` and `lib/`.
  `Board.tsx` keeps only wiring. Consistent with the established layout.
- Tailwind only; no new `.css` file.
- `prisma/schema.prisma` untouched, as the proposal said — so no `db push` and no data-model entry
  were owed.
- npm only: no `pnpm`/`yarn` anywhere in the diff; `scripts/seed-e2e.ts` shells out to
  `npx prisma db push`.
- New UI interaction has a test: the two card controls, both dialogs, the board wiring and the e2e
  path are all covered.
- Red-then-green: tasks 2.3/2.5 and 3.1 are written red-first and the commit order supports it
  (`cacd5b2` and `e473d1c` each land the action/hook change with its tests). Task 2.1 is declared
  **not** red-first with a reason — see Open questions; I think the call is right.

One finding, on commit granularity:

- **[Minor]** `R20261001-10` commit `1966d8a` (`test(e2e): edit and delete an application end to
  end`) — the commit is labelled for tests but carries two production fixes
  (`ApplicationDialog.tsx` and `ConfirmDeleteDialog.tsx` moving from module-level label ids to
  `useId`, which fixes a real announcement bug), a rework of the e2e harness
  (`e2e/reset-board.ts`, `scripts/seed-e2e.ts`, `.gitignore`), the new spec itself, and three
  `spec.md` change-log entries. That is at least three logically complete changes in one commit,
  against `AGENTS.md`'s "one commit = one logically complete change", and the `test` type hides a
  user-facing accessibility fix the same way the `docs` type did in `R20261001-3`: somebody
  bisecting "when did the edit dialog start announcing itself correctly" would not look here. The
  commit body does describe both fixes, which is why this is Minor and not more. Non-blocking, and
  consistent with how the two earlier instances were graded.

## 3. Edge cases

- **A card dragged twice in quick succession** — unchanged from `add-drag-and-drop`: the pending set
  holds each card independently and the handle is disabled per card. The merge into one reducer did
  not weaken it; `useBoardCards.test.ts` still has the interleaved two-card case and it still
  asserts that settling the second write does not release the first.
- **A card dropped into the status it is already in** — untouched by this change. `planCardMove`
  returns `null` for the same column and `planStatusChange` returns `null` when nothing changes, so
  `statusChangedAt` is not reset. Editing cannot reach that path at all: `updateApplication` writes
  only the four validated fields, pinned by `applications.test.ts` asserting the exact key set, and
  the e2e edit test compares the stored `status`, `appliedDate` and `statusChangedAt` against the
  values read before the edit. This is the strongest-covered requirement in the change.
- **An application deleted while an action against it is in flight** — reasoned through all four
  orderings. Delete lands before an in-flight move: the move's transaction finds no row, returns
  `NOT_FOUND`, revalidates, and the board ends up matching storage. Move lands first: both writes
  succeed and the row is gone. An edit concurrent with a move touches disjoint columns, so neither
  is lost. A second deletion of the same row returns `NOT_FOUND` rather than failing obscurely. No
  data is written wrongly in any ordering. The one case that is handled but *silently* is the edit
  of a deleted row — `R20261001-6`.
- **Empty, whitespace-only and very long values in every field** — the edit path is the same
  `validateApplicationInput` as the add path (trim after CRLF normalisation, `APPLICATION_LIMITS`,
  `optionalText` mapping `""` to `null`). `ApplicationForm.test.tsx` runs the cleared-company,
  non-http-link and over-maximum cases in edit mode, and the e2e spec proves a cleared link is
  stored as SQL `NULL` rather than `""`.
- **A status in the database the enum does not cover** — unchanged and still handled upstream by
  `groupApplicationsByStatus`; none of the new code reads or writes `status`.

No findings.

## 4. Test strength

The deletion and edit tests are, with the exceptions below, the kind that fail when the logic is
inverted: `Board.test.tsx` defers the server action so the optimistic window is asserted while it is
the only thing holding the card off the board; the second-failure test asserts the region is cleared
*between* the two messages, which is what makes the second an announcement rather than stale text;
`useBoardCards.test.ts` settles the move after the deletion to show the older optimistic change
cannot resurrect the card; `applications.test.ts` asserts that an unclassifiable failure does **not**
revalidate, which is the assertion that stops "revalidate on every failure" from passing the two
tests above it. `ApplicationCard.test.tsx` counts controls rather than listing them, so a fourth
button has to fail.

The e2e reasoning for the two deliberately uncovered scenarios holds. jsdom implements neither
`showModal()` nor the focus trap, and both dialog test files stub `showModal`/`close` only to keep
`open` in step — they do not pretend to test the trap. `e2e/edit-and-delete.spec.ts`'s `tabTrail`
helper is a real check and not a vacuous one: it distinguishes `OUTSIDE` from Chromium's one-step
`wrap` on `document.body`, and it additionally asserts that more than three *distinct* in-dialog
targets were reached, so a run where focus never moved at all cannot pass. Focus restoration is
asserted against the originating control. I am satisfied that "Focus does not escape the open form"
and "Focus does not escape the confirmation" are covered rather than waived.

- **[Minor]** `R20261001-7` `components/application-form/ConfirmDeleteDialog.test.tsx:124-150` with
  `components/board/Board.tsx:104-110` and `:181-186` — the two tests for the `pending` prop
  ("holds the confirm control while the deletion is being stored", "does not fire a second
  confirmation while the first is in flight") assert a state the application cannot produce.
  `confirmDelete` does `setDeletingId(null)` **before** `removeCard`, so by the time any deletion is
  in flight `deleting` is `null` and `pending={deleting !== null && isCardBusy(deleting.id)}` is
  permanently `false`; the dialog is also unmounted. The prop and its "Deleting…" label are dead
  code reachable only from a test. The requirement they are filed against ("A deletion in flight
  cannot be started again") *is* satisfied, by a different mechanism — the confirmation is gone and
  the card has been optimistically removed, so there is no control to activate — and that mechanism
  is what `Board.test.tsx` ("closes the confirmation rather than leaving it naming a card that is
  gone", plus the in-flight removal test) actually covers. This is the `R20261001-1` class: a test
  that reads as evidence for a guarantee held somewhere else. Minor, because no user-visible
  behaviour is wrong; the author may ship as is, or drop the prop, or wire it.
- **[Note]** `components/board/useBoardCards.test.ts` — "reports a missing application without
  restoring its card" asserts `idsOf(shown)` is `["a", "b"]`, i.e. the card *is* present. The
  comment says plainly why (the hook deliberately does nothing; the revalidated server list is what
  removes it), so this is not a misleading assertion, only a misleading title. The two halves of the
  requirement are each covered — the action revalidates (`applications.test.ts`) and the board
  renders from the server list (`Board.test.tsx`, "keeps the card off once the stored list arrives
  without it") — but no single test shows the card leaving on a not-found deletion.
- The missing board-level and e2e coverage for the not-found **edit** is part of `R20261001-6` and
  is not counted again here.

Everything else in the delta specs has at least one test that could fail: I walked all 54 scenarios
and found no other silent gap.

## 5. Input safety

The edit write path is `updateApplicationFromForm` → `updateApplication` → `validateApplicationInput`
→ Prisma, i.e. the same validation the add path uses, with no second set of rules: required-field
handling, CRLF normalisation then trim, `APPLICATION_LIMITS` (120/120/2048/2000) measured on the
trimmed value, and `isHttpUrl` restricting `link` to `http:`/`https:`. No write path bypasses it —
there is no second update site. The hidden `id` field is treated as untrusted: it is handed over
untouched and `isValidId` refuses a non-string or an empty string, with tests for a missing and an
empty id that also assert the database was not touched. `maxLength` on the inputs is advisory only
and the server limit is what refuses.

Values read back out of the database are re-checked where it matters: `ApplicationCard.tsx:57-58`
still re-runs `isHttpUrl` before rendering `href`, so a `javascript:` URL inserted directly into
SQLite is not rendered as a link — the `harden-kanban-board` guard is intact and still on the render
path, now with a test for the cleared-link case beside it. The new dialogs render `company` and
`position` as text children only, never into an attribute that could execute.

No findings.

## 6. Accessibility

- Keyboard movement of a card: `KeyboardSensor` is still registered **with** the column-aware
  `coordinateGetter` (`Board.tsx:110-115`), not merely installed, and the new controls did not
  displace it.
- Both new controls are real `<button type="button">` elements with an `aria-label` naming the
  application, on a role that permits naming — so the name survives into the accessibility tree,
  unlike the `generic`-role count label the 2026-09-27 review caught. `ApplicationCard.test.tsx`
  queries them `byRole("button", { name: … })`, which is an accessibility-tree query, not an
  attribute assertion.
- Icon-only: every `<svg>` in the new controls carries `aria-hidden="true"`, so the accessible name
  comes from the label alone.
- Live region: deletion failures go to the board's existing `role="alert" aria-live="assertive"`
  region, which is always rendered so the region exists before the message; the test asserts the
  `aria-live` value as well as the text. Edit failures are announced by moving focus to the field at
  fault (the `R20260929-2` mechanism) or rendered in the form's one `role="alert"`.
- Both dialogs are labelled by a heading through `useId`, and the confirmation is additionally
  described by its body text; `ConfirmDeleteDialog.test.tsx` asserts `toHaveAccessibleName` and
  `toHaveAccessibleDescription` on the `dialog` role rather than asserting attributes.
- Focus preserved after a move: unchanged, still keyboard-only, still pinned by e2e.

- **[Minor]** `R20261001-8` `components/board/ApplicationCard.tsx:7` — the shared `CONTROL_CLASS`
  gives the three icon-only controls a focus indicator of `focus-visible:bg-slate-100` and nothing
  else: a tint change from white to `slate-100` is roughly a 1.07:1 contrast ratio against the
  card, with no ring, outline or border. `app/globals.css` adds no global focus style, and the UA
  outline is not suppressed but is also not what is being relied on here. The header's add control
  does it properly (`focus-visible:outline-2 focus-visible:outline-offset-2`). A keyboard user
  tabbing across a column cannot easily see which of the three controls they are on — and this
  change triples the number of such controls per card, which is what brings a pre-existing choice
  into this diff. Minor, non-blocking; the fix is the same two utilities the add button already
  uses.

## 7. Consistency with earlier features

Server actions still return `ActionResult` and never throw: `updateApplicationFromForm` mirrors
`createApplicationFromForm` exactly, including the comment explaining why no `try` of its own is
needed, and the new `notFound()` helper gives all three actions one not-found branch instead of
three copies. `FAILED.remove`/`FAILED.update` come from `lib/applications/action-result.ts` and the
tests assert the constants, so the `R20261001-2` drift fix is respected rather than re-opened. The
`lib/` layout, the exhaustive `satisfies Record<…>` tables, the controlled-form reasoning and the
comment style all match what is already there.

- **[Minor]** `R20261001-9` `components/board/BoardColumn.tsx:13` and `:24`, with
  `components/board/DraggableCard.tsx:10` — the hook's predicate was deliberately renamed
  `isMovePending` → `isCardBusy` because after the merge it answers "this card has a write of either
  kind in flight", and `design.md` carves out exactly one exception: `ApplicationCard`, where the
  prop governs the drag handle specifically. `BoardColumn` and `DraggableCard` are not that
  exception — `BoardColumn` takes the predicate itself (`(cardId: string) => boolean`) and
  `Board.tsx:171` passes `isCardBusy` into a prop still called `isMovePending`, so two intermediate
  components now carry the move-only name for a move-or-delete meaning. Minor, naming only; nothing
  behaves wrongly.

### The two fixes from the e2e run

Both are sound, and I checked them as behaviour rather than as the presence of plausible code.

- **Duplicate dialog label ids** — `useId()` per instance in both dialogs, and
  `ConfirmDeleteDialog` uses it for `aria-describedby` too. With the header's add dialog and the
  board's edit dialog on one page there is no longer a shared constant for `aria-labelledby` to
  resolve to, so the edit dialog cannot announce itself as "Add application". The confirmation test
  asserts the resolved accessible name, which is the assertion that would fail if the ids collided
  again.
- **`e2e/reset-board.ts` restoring from a snapshot** — this is the right shape. The snapshot is
  written by `scripts/seed-e2e.ts` as raw storage values read back through `better-sqlite3`, so
  restoring does not depend on how Prisma encodes a `DateTime`; the restore is `DELETE` plus
  re-insert inside one transaction, so no test can observe an empty board; and it is read from disk
  on every call, so a worker Playwright restarts after a failure cannot snapshot an
  already-mutated database.
  **On order-dependence specifically: the suite cannot become order-dependent through this.**
  `playwright.config.ts` pins `workers: 1` and `fullyParallel: false`; every one of the four spec
  files calls `resetBoard()` in `beforeEach`, so each test starts from the seeder's board whatever
  ran before it, including the long-value row inserted straight into the database and a seeded row
  another spec deleted. The snapshot is guaranteed to exist before the first test because
  `webServer.command` runs `npm run e2e:db` ahead of the build, and `reuseExistingServer: false`
  means that always happens. `move-card.spec.ts` has no `afterAll` reset, which leaves the file's
  last mutation in place after a run — harmless, because the next run's first `beforeEach` undoes
  it. The only rough edge worth knowing: if `e2e-seed.json` is absent, `readFileSync` throws a raw
  `ENOENT` rather than the "run `npm run e2e:db`" message below it, which only fires for a
  zero-row snapshot. Note, not a finding — the config makes the absent case unreachable in the
  supported path.

---

## Open questions

1. **Task 2.1's "not red-first, and it cannot be" — I think this is the right call and would not
   restructure anything.** `data` is whatever `validateApplicationInput` returned, so the guarantee
   is structural; manufacturing a red would mean first writing `statusChangedAt: new Date()` into
   the action and then removing it, which buys chronology at the cost of committing a known defect.
   The test as written is strong for a regression guard because it asserts the sorted key set, not
   only the values, and the e2e spec checks the three forbidden fields against the row as it was
   before the edit — a reset clock is invisible on the board, so that second measurement is what
   makes the guarantee observable. `AGENTS.md` asks red-first for *new* business logic; this is
   pre-existing logic being pinned, and the amended task says so in the open rather than implying it.
2. After a **confirmed** deletion the native `<dialog>` restores focus to the card's delete control,
   which has just been unmounted, so focus falls to `document.body`. The `application-delete`
   requirement permits this ("where that control still exists"), and the author may prefer it to
   guessing a target — but a keyboard user is silently returned to the top of the document after
   every deletion. Worth a decision, not a defect.
3. On a not-found **deletion**, between the transition settling and the revalidated list arriving,
   the hook's optimistic removal is dropped while the server list may still contain the row. If
   those two do not land together the card flashes back before vanishing. The end state the spec
   asks for is reached either way; I could not measure the intermediate frame.

## Blocking follow-ups

1. **[Major]** `R20261001-6` — an edit of an application that no longer exists closes the form and
   destroys the "Application not found" message with it, so the outcome is indistinguishable from a
   successful save. `components/board/Board.tsx:84-97`, `:180`;
   `components/application-form/ApplicationDialog.tsx:84-100`. The scenario has no test at board or
   e2e level, which is why it survived the run.

## Non-blocking suggestions — shipping does not depend on any of these

- `R20261001-7` — `pending` on `ConfirmDeleteDialog` is unreachable from `Board`, and its two tests
  assert a state the application cannot produce.
- `R20261001-8` — the three icon-only card controls have a background-tint-only focus indicator.
- `R20261001-9` — `BoardColumn`/`DraggableCard` still name the merged predicate `isMovePending`.
- `R20261001-10` — commit `1966d8a` bundles two production fixes, the e2e harness rework, the new
  spec and the `spec.md` entries under a `test(e2e)` type.
- Note — the hook test titled "reports a missing application without restoring its card" asserts
  that the card is present; the title, not the assertion, is what is off.
