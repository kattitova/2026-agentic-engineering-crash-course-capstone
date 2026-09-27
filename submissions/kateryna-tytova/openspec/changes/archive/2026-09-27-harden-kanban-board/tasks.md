# Tasks

Each fix is paired with its own test, and the pair is one commit. The pairs that need no DOM come
first, so the two review findings that matter most land before any new dependency is installed.

## 1. Fixes that need no DOM (TDD)

- [x] 1.1 Extend `lib/applications/board.test.ts` with a case where one application carries a
      status outside the five known ones, asserting the board data is still produced and the other
      applications are grouped normally, and verify it fails with "Cannot read properties of
      undefined (reading 'push')" (red step)
- [x] 1.2 Guard `groupApplicationsByStatus` with `isApplicationStatus` from
      `lib/applications/status.ts` so an unrecognised row is skipped, and verify the new test and
      all existing grouping tests pass
- [x] 1.3 Replace the `dotClass` assertion in `board.test.ts:55-59` with one that pins the five
      colours and their uniqueness, and verify it fails when two columns are given the same class
      (red step), then confirm it passes against the current definitions
- [x] 1.4 Run `npm run verify` and confirm lint, typecheck and the unit suite pass

## 2. Read path and error boundary

- [x] 2.1 Move `listApplications` out of `app/actions/applications.ts` into a new
      `lib/applications/queries.ts` as a plain async function with no `"use server"`, update the
      import in `app/page.tsx`, and verify `grep -rn "listApplications" app/actions` returns nothing
      and the board still renders every card
- [x] 2.2 Run `npx next build` and record that `/` is reported as `○ (Static)` — the board's data is
      baked in at build time, which the "data changed elsewhere" scenario forbids (red step; found
      during implementation, not in the review)
- [x] 2.3 Call `await connection()` from `next/server` in `lib/applications/queries.ts` before the
      query, and verify `npx next build` now reports `/` as `ƒ (Dynamic)`
- [x] 2.4 Add `app/error.tsx` using this Next version's `retry` prop (not `reset`), and verify it is
      compiled into the production build and that its `retry()` re-runs the loader rather than only
      re-rendering the boundary's children. A first-request failure is **not** covered: React error
      boundaries need a Suspense boundary to recover into, and adding one puts a loading placeholder
      in the first paint, which the board's existing spec forbids. Record that limit in design.md
      rather than trading away first-paint data
- [x] 2.5 Confirm the board still shows every stored application after the change, and that a row
      inserted directly into the database appears on reload without rebuilding
- [x] 2.6 Run `npm run verify` and confirm it passes

## 3. Component test setup

- [x] 3.1 Install `jsdom`, `@testing-library/react` and `@testing-library/jest-dom` with
      `npm install --save-dev`, and verify they appear in `devDependencies` and no
      `pnpm-lock.yaml` is created
- [x] 3.2 Add `**/*.test.tsx` to `include` in `vitest.config.mts`, keeping `environment: "node"` as
      the default, and verify `npx vitest run --reporter=verbose` still collects the existing three
      test files
- [x] 3.3 Add a throwaway `.test.tsx` file with a `// @vitest-environment jsdom` docblock that
      renders a trivial element, verify it passes, then delete it — this proves the opt-in
      environment works before any real test depends on it

## 4. Render safety and accessibility (TDD, jsdom)

- [x] 4.1 Write `components/board/ApplicationCard.test.tsx` asserting that an application whose
      stored link is `javascript:alert(1)` renders no anchor, and verify it fails against the
      current component (red step)
- [x] 4.2 Export `isHttpUrl` from `lib/applications/validation.ts` and call it in `ApplicationCard`
      before rendering the anchor, and verify the new test passes and a normal `https://` link still
      renders
- [x] 4.3 Add a test asserting the posting link's accessible name identifies its application rather
      than being "View posting" on every card, verify it fails (red step), then give the link a
      per-card accessible name and verify it passes
- [x] 4.4 Write `components/board/BoardColumn.test.tsx` asserting the count is announced as a number
      of applications rather than a bare digit, verify it fails (red step), then label the count
      badge and verify it passes
- [x] 4.5 Add a test asserting the card applies wrapping and line-clamp classes to the company and
      position, verify it fails (red step), then apply those classes in `ApplicationCard`
- [x] 4.6 Open the board in `npm run dev` with one application whose company name is a single
      200-character unbroken word, and verify the columns keep their widths and positions — this is
      the part jsdom cannot check
- [x] 4.7 Run `npm run verify` and confirm it passes

## 5. Regression tests for the existing display requirements

These four are characterization tests: the code is already correct, so there is no red step. Each is
proved non-vacuous by mutation instead.

- [x] 5.1 Test that a column with three applications shows the count 3 and an empty column shows 0,
      verify it passes, then temporarily delete the count badge from `BoardColumn.tsx` and verify
      the test fails before restoring it
- [x] 5.2 Test that an empty column shows its empty-state message, verify it passes, then
      temporarily delete `BoardColumn.tsx:24` and verify the test fails before restoring it
- [x] 5.3 Test that a card with no stored link renders no link control while a card with one does,
      verify it passes, then temporarily render the anchor unconditionally and verify the test fails
      before restoring it
- [x] 5.4 Test that a card shows both its company and its position, verify it passes, then
      temporarily remove the position element and verify the test fails before restoring it
- [x] 5.5 Run `npm run verify` and confirm the full suite passes with the component tests included

## 6. Documentation and final verification

- [x] 6.1 Add a `spec.md` Spec change log entry recording that the disabled "Add application" button
      stays for layout fidelity and becomes functional in add-application, and verify the entry
      names the change that will replace it
- [x] 6.2 Add a `spec.md` Spec change log entry stating the convention — server actions are
      mutations, return `ActionResult` and never throw; data loaders are ordinary functions that
      throw and are caught by `app/error.tsx` — and verify it names `app/error.tsx` as the scope
      addition it justifies
- [x] 6.3 Append a short note to `docs/review-log.md` recording which findings this change resolved
      and which were deferred to add-application and add-drag-and-drop, and verify every Major
      finding is accounted for as either resolved or deferred with a reason
- [x] 6.4 Run `npm run verify` and confirm it passes with no errors before marking the change
      complete

## 7. Second review pass (2026-09-27)

Findings from the review of this change while it was still uncommitted. Folded in here rather than
into a new change, because the change is neither committed nor archived — the situation the first
review pass did not have.

- [x] 7.1 Replace the count badge's `aria-label` with visually hidden text and hide the visible
      digit, and verify in a real accessibility tree (Chrome via CDP) that a `StaticText` node named
      "N applications" is present and the bare digit is ignored
- [x] 7.2 Emit the hidden count as a single template literal, and verify the accessibility tree
      carries one node named "N applications" rather than the separate "N" / "applications" nodes
      that `{count} {word}` produces
- [x] 7.3 Rewrite the count test to assert announced text and that the digit is `aria-hidden`,
      instead of asserting an `aria-label` attribute that ARIA's name-prohibited `generic` role makes
      unreliable
- [x] 7.4 Name each column `<section>` with `aria-labelledby` and each card `<article>` after its
      company, and verify the accessibility tree lists five named regions and one named article per
      card
- [x] 7.5 Say in the posting link's accessible name that it opens a new tab, and verify with
      `toHaveAccessibleName(/opens in a new tab/i)`
- [x] 7.6 Put `@testing-library/jest-dom` to use in both component test files and replace every
      `toBeDefined()` with an assertion that states its intent, and verify the suite still passes
- [x] 7.7 Remove the non-null assertion in `BoardColumn.test.tsx`, and verify no `!` assertion
      remains in the project's own source
- [x] 7.8 Run `npm run verify` and confirm it passes
