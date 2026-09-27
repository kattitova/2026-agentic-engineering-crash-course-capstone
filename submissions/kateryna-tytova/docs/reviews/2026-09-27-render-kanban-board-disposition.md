# 2026-09-27 — disposition of the 2026-09-21 findings (`harden-kanban-board`)

Written by the author, not the reviewer. Every finding above is accounted for below as resolved,
deferred with a reason, or declined with a reason. The review itself fixed nothing, by design.

## Resolved in `harden-kanban-board`

| Finding | Resolution | Evidence |
| --- | --- | --- |
| §3 [Major] crash on an unknown status | `groupApplicationsByStatus` skips a row whose status is not one of the five | red test reproduced the reviewer's exact error, `Cannot read properties of undefined (reading 'push')` |
| §3/§5 [Major] long values distort the board | `break-words` + line clamp on company and position | measured in Chromium at 1440px with a 200-character unbroken value: horizontal overflow 613px before, 0px after |
| §4 [Major] no test covers the rendering requirements | 4 characterization tests in `BoardColumn.test.tsx` and `ApplicationCard.test.tsx` | each proved non-vacuous by mutation; deleting the empty-state message now fails `npm run verify` |
| §4 [Minor] weak `dotClass` assertion | pins the five colours and asserts uniqueness | giving Interview the Applied colour turns it red |
| §5 [Minor] `href` rendered without a second check | `isHttpUrl` exported and called in `ApplicationCard` | `javascript:alert(1)` renders no anchor |
| §6 [Minor] unlabelled count badge | `aria-label` such as "3 applications" | `getByLabelText(/3 applications/i)` |
| §6 [Minor] identical link names across cards | accessible name includes the company | `getByRole("link")` name contains "Acme Cloud" |
| §7 [Note] `listApplications` outside the `ActionResult` convention | moved to `lib/applications/queries.ts`; convention restated in `spec.md` | it was also an unintended public endpoint: the actions file carries a file-level `"use server"` |
| §1 [Note] column order stated unconditionally | spec now states it as a wide-viewport guarantee | delta spec, `kanban-board` |
| Open question 1 — disabled "Add application" | kept, recorded in the `spec.md` Spec change log | the route `AGENTS.md` prescribes for scope beyond the spec |
| Open question 3 — `listApplications` shape | keeps throwing; leaves the server-action file instead | see above |

## Found during this work, not in the review

- **The board page was prerendered as static content.** `next build` reported `/` as
  `○ (Static)`: Prisma on `better-sqlite3` is a synchronous driver, so the query completed during
  prerendering and the board was frozen at build time. §1 marked "data present on first paint" as
  satisfied from `app/page.tsx`, which is true under `next dev` and false in a production build.
  The "data changed elsewhere" scenario could not pass. Fixed with `connection()`; verified by
  inserting a row directly into `dev.db` and reloading the served production build without
  rebuilding.
- **A mechanism correction to §3.** A long unbroken value does not widen its grid column —
  Tailwind's `grid-cols-5` is `minmax(0, 1fr)`, so the track holds. The text overflows the track
  and pushes the document's scroll width out instead. The symptom the reviewer describes is real;
  the cause is different.
- **`app/error.tsx` cannot catch a first-request failure.** React error boundaries need a Suspense
  boundary to recover into. Adding one (`app/loading.tsx`) does make the fallback render, and puts
  a loading placeholder in the first paint, which the board's spec forbids. The boundary is kept
  for failures after the app is running; the limit is recorded in `spec.md` and in the change's
  design.

## Deferred, with a reason

- **§3/§5 [Major] no maximum field lengths.** Deferred to `add-application`, where the form lives
  and where `maxLength` naturally belongs. No gap is left open: `createApplication` and
  `updateApplication` have no caller today, so the only write paths are `prisma/seed.ts` and the
  tests. The CSS half of the finding was not deferred — a long value can no longer distort the
  board whatever its length.
- **§3 and §6 [Notes] on drag-and-drop concurrency and `KeyboardSensor`.** These are decisions for
  `add-drag-and-drop`, not defects in shipped code, and belong in that change's design.
- **§2 [Minor] commit the proposal before implementation.** Applies to `add-drag-and-drop`.

## Declined

- **§1 [Note] unused `@playwright/test` and `@dnd-kit` packages.** Left in place. They are the
  dependencies of `add-drag-and-drop`, which is already proposed; removing and reinstalling them
  would churn the lockfile for no behavioural gain. `@playwright/test` earned its keep here anyway:
  it measured the layout fix above.
