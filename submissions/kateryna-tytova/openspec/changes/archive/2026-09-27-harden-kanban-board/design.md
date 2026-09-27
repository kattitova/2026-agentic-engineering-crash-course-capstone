# Design

## Context

See proposal.md — Why. The findings come from `docs/review-log.md` (2026-09-21).

Constraints that shape the approach:

- `groupApplicationsByStatus` returns `Record<ApplicationStatus, JobApplication[]>`. The type
  asserts that `grouped[application.status]` exists, so TypeScript reports nothing at the one place
  that can fail. The guard has to be a runtime check; there is no type-level fix.
- `isApplicationStatus` already exists in `lib/applications/status.ts` and is already used by
  `updateApplicationStatus`. `isHttpUrl` already exists in `lib/applications/validation.ts` but is
  module-private.
- `app/actions/applications.ts` carries a file-level `"use server"`, so every export is a public
  endpoint. `listApplications` has exactly one caller, `app/page.tsx`.
- `vitest.config.mts` sets `environment: "node"` and `include: ["**/*.test.ts"]`. The 30 existing
  tests are pure-logic tests and benefit from that.
- The board's three components are synchronous, presentational Server Components with no
  `"use client"` directive and no server-only API use.

## Goals / Non-Goals

**Goals:**

- Make one bad row cost one card, not the page.
- Make the four display requirements fail loudly in `npm run verify` when they regress.
- State the mutation/loader convention so that it has no exceptions.
- Keep the existing unit suite as fast as it is today.

**Non-Goals:**

- Field length limits and their `spec.md` data-model entries. Deferred to add-application.
- Any change to the four mutating server actions.
- Screenshot or visual-regression testing. Truncation is verified by the class it applies and by a
  manual check, not by measured layout — see the risk below.

## Decisions

### An unknown status drops the card rather than being routed to a fallback column

`groupApplicationsByStatus` validates each row with `isApplicationStatus` and skips the ones that
fail. The return type is unchanged.

Alternative considered: routing unknown statuses into a sixth "Unknown" column, or into Wishlist.
Rejected. A sixth column contradicts the "exactly five columns" requirement, and folding a row into
Wishlist shows the user a status the database does not hold — a quiet lie is worse than an absent
card. Dropping is also what the spec now says, and it is the smallest behaviour that turns a total
outage into a local loss.

The skip is silent to the user. There is no error surface on the board for a data-integrity problem
the user cannot act on.

### Long values wrap rather than being truncated with an ellipsis

The card applies `break-words` so a long unbroken token wraps inside its box, and a line clamp so a
very long value cannot make one card several times the height of its neighbours.

Alternative considered: `truncate` (single line, ellipsis). Rejected for the company name — the
company is how the user recognises a card, and truncating to one line hides exactly the part that
distinguishes "Acme Cloud Platform GmbH" from "Acme Cloud Services GmbH". Wrapping keeps the whole
value reachable; the clamp keeps the layout intact.

### `isHttpUrl` is exported and reused rather than duplicated

The card needs the same scheme check the write path uses. `isHttpUrl` is exported from
`lib/applications/validation.ts` and called in `ApplicationCard` before rendering an anchor.

Alternative considered: writing a second check in the component. Rejected — two copies of a
security-relevant predicate drift, and the reviewer's point (§5) is precisely that the render path
trusts a value the write path validated. One predicate, two call sites.

### The read path leaves the server-action file; a new error boundary catches its failures

`listApplications` moves to `lib/applications/queries.ts` as a plain async function.
`app/page.tsx` imports it from there. `app/error.tsx` is added as the boundary that catches a
failure of that read.

This settles the reviewer's §7 note without introducing an exception to the `ActionResult`
convention. The convention becomes: **server actions are mutations, return `ActionResult` and never
throw; data loaders are ordinary functions, throw, and are caught by an error boundary.**

Alternative considered: giving `listApplications` an `ActionResult` shape. Rejected — the Server
Component would then branch on `ok` before rendering, which is the error-boundary's job done by
hand, and the function would stay a public endpoint for no reason.

`app/error.tsx` is a new file that `spec.md` does not list. The addition is recorded in the
`spec.md` Spec change log alongside the convention itself.

**What the boundary does and does not cover.** Measured against a production build, not assumed:
React error boundaries do not render a fallback during server-side rendering; they need a Suspense
boundary to recover into. `app/page.tsx` awaits the loader at the top of the page with nothing
suspended above it, so a failure on the *first* request aborts the shell and Next serves its own
error document with status 500 — `app/error.tsx` never runs. Adding a Suspense boundary
(`app/loading.tsx`) does make it render; it was tried, and the served HTML then contains a loading
placeholder instead of the board, which the existing requirement "The board reflects the stored data
when it is opened" forbids in as many words.

The spec wins. `app/error.tsx` is kept for what it does cover: a failure after the app is running —
client-side navigation back to the board, and the transitions that add-drag-and-drop will introduce,
since an error thrown inside `startTransition` bubbles to the nearest error boundary — plus the
`retry()` affordance. The convention is therefore stated as: loaders throw, and `app/error.tsx`
handles that failure once the app is running; a failure on the very first request is served as
Next's error page. Making the first request recoverable too would mean trading away first-paint
data, and that trade belongs to a different change.

### The read opts out of prerendering with `connection()`, not with a route segment config

`lib/applications/queries.ts` calls `await connection()` from `next/server` before the query.

Next's own documentation names this exact case under "Synchronous database drivers": a query
through a synchronous driver such as `better-sqlite3` completes during prerendering, so a page that
only reads the database, without touching `cookies()` or `headers()`, is prerendered as static
content. `npx next build` confirmed it — `/` was reported as `○ (Static)`.

Alternative considered: `export const dynamic = "force-dynamic"` in `app/page.tsx`. Rejected. It
puts the opt-out in the page, one level away from the reason for it, so a second page reading the
same loader would silently prerender again. `connection()` sits in the loader itself, where the
synchronous driver is, and travels with it.

Alternative considered: leaving the page static and relying on `revalidatePath("/")`. Rejected —
that only covers changes made through the app. The spec's "data changed elsewhere" scenario is
precisely the one it does not cover.

This also restores the ability to verify `app/error.tsx` at all: while the page was static, a
failing read was a build failure rather than a rendered boundary.

### The DOM environment is opt-in per file, not global

`vitest.config.mts` gains `*.test.tsx` in `include` but keeps `environment: "node"` as the default.
Component test files opt in with a `// @vitest-environment jsdom` docblock at the top.

Alternative considered: switching the global environment to jsdom. Rejected — it would move all 30
existing pure-logic tests into a simulated DOM they do not need, paying jsdom's startup cost on
every run of the fastest feedback loop the project has. Measured: one jsdom file takes the suite
from ~0.3s to ~2.2s, and about three quarters of that is environment startup.

A consequence worth writing down, because it looks like boilerplate otherwise: the config does not
set `globals: true`, since the existing tests import `describe`/`it`/`expect` explicitly. React
Testing Library's automatic cleanup registers itself through a global `afterEach`, so without
globals it never runs and renders accumulate in one document — "Found multiple elements with the
text: 3". Each component test file therefore calls `afterEach(cleanup)` itself. A shared setup file
was rejected: it would also load in the `node` environment, where importing RTL has no DOM to work
with.

### Component tests cover rendering; the e2e suite is left to drag-and-drop

jsdom has no layout engine: `getBoundingClientRect` returns zeros. That is fine for asserting what
a component renders and what its accessible names are, and it is fatal for anything that depends on
element geometry. The division is therefore not a preference:

| Layer | Covers | Why here |
| --- | --- | --- |
| Unit (`node`) | grouping, transitions, validation | no DOM needed |
| Component (`jsdom`) | count, empty state, conditional link, card content, link names | runs inside `npm run verify` |
| E2E (Playwright) | moving a card, persistence | dnd-kit needs real geometry |

Alternative considered: asserting the four display requirements in the Playwright spec planned for
add-drag-and-drop. Rejected on two counts. It would make `npm run verify` permanently blind to the
board's presentation, and it would put a fix for an archived feature behind an unimplemented one.

### Characterization tests are verified by mutation, not by a red step

`AGENTS.md` requires a failing test before the implementation for new business logic. The four
display tests are not new logic: the code is already correct and the tests exist to stop it
regressing. Writing them red would mean breaking working code first.

Instead, each is proved non-vacuous by mutation: write the test, watch it pass, temporarily remove
the line in the component it is meant to protect, confirm it fails, restore the line. The reviewer's
own phrasing is the acceptance criterion — "delete the empty-state message and `npm run verify`
stays green" must stop being true.

The genuinely new behaviour in this change — the status guard, the scheme re-check, the two
accessible names, the `dotClass` uniqueness assertion — follows the normal red-then-green order.

### The count is announced by hidden text, not by a label on the badge

The badge shows the digit with `aria-hidden`, and carries a visually hidden span with the full
phrase. The first attempt used `aria-label` on the badge `<span>`; a second review pass flagged it
and it was checked against a real accessibility tree rather than argued about.

What the check found, via Chrome DevTools Protocol on the running page: Chrome does *not* drop the
label — the node appears as `role=generic name="1 application" ignored=false`. The reviewer's
prediction about browser behaviour was wrong on that point. The concern behind it holds anyway:
ARIA gives `generic` "Name from: prohibited", so a name there is not something to rely on, and the
digit remained in the tree as a separate `StaticText` beside it. Hidden real text is exposed by
every screen reader and needs no exception.

One implementation detail that is easy to get wrong and invisible in tests: the hidden text must be
a single template literal. Written as `{count} {word}`, JSX emits three text nodes and the
accessibility tree contains "1" and "application" separately, with no node named "1 application" —
confirmed by the same probe. Testing Library normalises whitespace across text nodes, so a jsdom
test passes either way and cannot catch this.

### The per-request-render requirement is left to the e2e suite

Removing `await connection()` keeps `npm run verify` green, which the second review pass recorded as
a Major: the change exists to close exactly this kind of hole, and left one open for the requirement
it discovered itself.

Alternative considered: a unit test asserting that `queries.ts` calls `connection()`. Rejected — it
inspects the source text rather than the behaviour, and would pass against a call placed after the
query, which is the mistake worth catching. Alternative considered: parsing `next build` output for
`ƒ /` inside `verify`. Rejected — it puts a full build in the loop that is meant to answer in
seconds.

Deferred instead to the Playwright suite that `add-drag-and-drop` introduces, as a check that a row
inserted directly into the database appears on reload. That is the behaviour the requirement
describes, and the manual version of it is what verified the fix here. Until then the requirement is
covered by a recorded manual check, and that is stated in `docs/review-log.md` rather than left
implicit. The same applies to the accessibility-tree assertions above, which jsdom cannot make.

## Risks / Trade-offs

- **Truncation is asserted by class name, not by measured width** → jsdom cannot measure layout, so
  a test can only confirm the wrapping classes are applied. That catches accidental removal and
  nothing more. A real width regression is caught by the manual check recorded in tasks, and later
  by the e2e suite if a screenshot assertion is ever added.
- **RTL renders these components because they are synchronous** → the board's components are plain
  functions returning JSX today, so React Testing Library renders them directly. `add-drag-and-drop`
  turns `Board` into a client component; `BoardColumn` and `ApplicationCard` stay presentational, so
  the tests written here keep working. A future async Server Component would not be testable this
  way and would need its logic extracted, which `AGENTS.md` already requires.
- **Three new devDependencies for a small suite** → accepted. Four spec requirements currently have
  no automated protection at any level, and the remaining MVP features each add more presentation.
  The cost is paid once; each later test is a few lines.
- **A silently dropped card hides a data problem** → accepted for this change. The alternative is a
  user-facing warning about a condition the user cannot fix. If seeding or import ever becomes a
  user-facing feature, validation belongs there, not on the board.
- **`app/error.tsx` is functionality outside `spec.md`** → mitigated by recording it and its reason
  in the Spec change log, which is the route `AGENTS.md` prescribes for scope beyond the spec.
