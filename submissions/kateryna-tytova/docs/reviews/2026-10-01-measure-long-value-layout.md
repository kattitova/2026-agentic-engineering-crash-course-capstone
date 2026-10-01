# 2026-10-01 — measure-long-value-layout

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review — first pass over this change. It closes a ledger item (`R20260927-6`), but it
is not a response to a blocking finding from a previous review, so it is not a re-review.
**Reviewed:** `a1c9bc8..3612572` — commits `78440dc`, `cbbddda`, `2bdf163`, `3612572`: the new
`e2e/long-value-layout.spec.ts`, the rewritten test in `components/board/ApplicationCard.test.tsx`,
the change's `proposal.md` / `design.md` / `tasks.md` / `.openspec.yaml`, and the ledger entry in
`docs/reviews/decisions.md`. All committed; the only uncommitted file is `.agent-log/actions.jsonl`,
which is outside the change. No production code changed.
**Verification run:** `npm run verify` — passed (lint, `tsc --noEmit`, vitest: 9 files, 107 tests).
`npm run test:e2e` was **not** run: its `webServer` runs `npm run e2e:db`, which resets the schema
of `e2e.db`, and `next build`, which writes `.next/` — both are write commands this reviewer may not
run. The e2e results below rely on the author's tasks 2.3–2.5 and 5.3, and on reading the spec.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 2 minor.

## Previously decided — not re-raised

| Item | Ledger status | Why it is not raised here |
| --- | --- | --- |
| 2026-09-21 §2 — planning artifacts committed after the code | Deferred (`add-drag-and-drop`), closed | `proposal.md` and `design.md` land in `2bdf163`, after the test commit `78440dc`. Same class as the closed item; not re-raised. |
| `R20260927-7` — red-then-green order not readable from history | Declined | The new e2e test is a characterization test with no red step, proved by mutation instead (tasks.md preamble, 2.3, 2.4, 3.2). |
| `R20260929-3`, `R20261001-3` — commit-type/scope hygiene | Accepted, not rewritten | All four commits here carry `type(scope)` and none mixes a code path into a `docs` commit, so nothing new to say. |

## Status of the item this change closes

Hard rule 6 applies to `R20260927-6`, which this change records as closed.

| ID | Status | Evidence |
| --- | --- | --- |
| `R20260927-6` | **fixed** | The class-substring assertions are gone (`ApplicationCard.test.tsx:51-62`). The geometry is now measured in a real browser in both projects (`e2e/long-value-layout.spec.ts:81-123`), with a separately asserted control (`:52-67`) and a >100px guard on every width inside `columnWidths` (`:20-31`), so neither an empty selector nor a both-broken board can pass. The remaining jsdom test uses `getByText(long, { selector })`, whose default is exact full-string matching, so the `slice(0, 10)` mutation in task 3.2 would fail it as claimed. The mutation in task 2.3 (removing `line-clamp-3`) is the change that demonstrably breaks the layout, and the overflow assertion at `:111` is positioned to catch it. |

## 1. Spec compliance

No findings.

The requirement (`openspec/specs/kanban-board/spec.md:113-126`) is mapped: "wrap or be shortened"
is deliberately not pinned (task 2.4, `design.md` non-goals); "SHALL NOT change the width of its
column" → before/after width comparison (`:96-102`); "or the layout of the board" → no horizontal
document scroll (`:111`) and the text box contained in its column (`:115-122`); "its card contains
that value" → the visible heading (`:91-93`) and the jsdom test. `skip_specs: true` is correct — no
requirement changed. No functionality beyond the spec was added.

## 2. AGENTS.md compliance

No findings. No `any`; no production code; npm only; commits are `type(scope)`; `verify` passes.
The characterization-test exception to red-then-green is stated up front in `tasks.md` and backed by
recorded mutations, which is the project's convention for that case.

## 3. Edge cases

No findings. The interaction edge cases in the checklist (double drag, same-column drop, delete in
flight, form-field values, unknown status) are not touched by a test-only change. The edge cases the
change does own are handled: `workers: 1` keeps the insert from racing another spec; `beforeEach`
and the new `afterAll` both call `resetBoard`, so the inserted `e2e-long-value` row no longer depends
on file order (task 4.1); the insert uses the same column list and timestamp form as the existing
direct insert in `e2e/move-card.spec.ts:117-120`.

## 4. Test strength

- **[Minor]** `R20261001-4` `e2e/long-value-layout.spec.ts:105-108` (also `tasks.md:29`, and the
  ledger's "Only the overflow assertion catches it") — the claim that, with the clamp removed, "the
  width comparison above passes and **only this fails**" is not something the mutation could show.
  Playwright's `expect` is a hard assertion: once `:111` threw, the bounding-box assertions at
  `:115-122` never ran. So the mutation proves the overflow assertion is non-vacuous, but says
  nothing about whether the third measurement would also have failed — and by the card's own comment
  (`ApplicationCard.tsx:43-48`, the unclamped `h3` is a flex item that stops shrinking below its
  min-content width) it plausibly would, since the `h3` box would then extend past the column. The
  consequence is documentary, not behavioural: the stated justification for three measurements
  ("only the overflow assertion catches it") rests on an assertion order, and a later reader deciding
  which assertion is redundant would be reasoning from it. No user-visible loss.

## 5. Input safety

No findings. No write path changed. The test inserts a 200-character value directly into `e2e.db`
specifically to bypass `APPLICATION_LIMITS`, which is the stated purpose and mirrors the existing
direct-insert pattern; it does not weaken any validation.

## 6. Accessibility

No findings. No UI changed. The new spec addresses columns by `role="region"` and the card by
`role="heading"` with an accessible name, so it also implicitly re-checks that those names survive
into the accessibility tree.

## 7. Consistency with earlier features

- **[Minor]** `R20261001-5` `openspec/changes/measure-long-value-layout/tasks.md:27-29` (same
  sentence in `decisions.md`, the author's file) — says the archived 613px note "does not say at which
  viewport, so the numbers are not comparable". The earlier record does say:
  `docs/reviews/2026-09-27-render-kanban-board-disposition.md:11` gives "measured in Chromium at
  1440px with a 200-character unbroken value: horizontal overflow 613px before". The conclusion — the
  new numbers at 1280/1100 are what the test now holds — survives, but the stated reason is wrong, and
  the comment in `components/board/ApplicationCard.tsx:48` still carries "613px … without" as the
  live measurement, which this change has superseded without updating. No user impact.

## Open questions

None.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions (shipping does not depend on these)

- `R20261001-4` — the "only the overflow assertion catches it" justification is an artefact of hard
  assertions stopping at the first failure; the third measurement's non-vacuity is unproven either way.
- `R20261001-5` — the 613px note did name its viewport (1440px); `tasks.md` 2.3 and the ledger say it
  did not, and the card's comment still quotes the superseded number.
