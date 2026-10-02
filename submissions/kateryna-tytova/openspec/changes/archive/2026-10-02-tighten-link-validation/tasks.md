# Tasks

Section 1 is a rename and nothing else, and it comes first so that no later commit mixes a rename
with a change of behaviour. It has to be all-or-nothing: `ApplicationCard.tsx` imports the function
by name, and under Vitest a missing named import is `undefined` rather than a compile error, so
renaming the definition without its callers turns every card test that renders a link into a
`TypeError` instead of a failed assertion.

## 1. Rename only, behaviour unchanged

- [x] 1.1 Rename `isHttpUrl` to `isAcceptableLink` in `lib/applications/validation.ts` and update
      both call sites in the same step — `validateApplicationInput` in the same file, and the import
      and call in `components/board/ApplicationCard.tsx`. Change nothing else. Verify: `npm run
      verify` passes with no test edited, and `grep -rn isHttpUrl` finds nothing outside
      `openspec/changes/archive/`.

## 2. The host rule (red first)

- [x] 2.1 Add failing cases to `lib/applications/validation.test.ts` for every host the
      application-form delta refuses — `https://test`, `http://a`, `https://.com`, `https://a..b`,
      `https://-.com`, `https://example.com.`, `https://a.b`, `https://прикла.д`,
      `https://localhost:3000`, `https://127.0.0.1`, `https://[::1]` — each expecting a `link`
      error. Verify: `npm run test` fails on these and on nothing else.
- [x] 2.2 Add regression guards for the hosts that must stay accepted — `https://example.com/jobs/1`,
      `http://example.com`, `https://jobs.example.co.uk/1`, a LinkedIn-shaped address with query
      parameters, `https://careers_eu.example.com`, and an internationalised domain under a real
      top-level name (`https://приклад.укр`). These pass today and must still pass after 2.4, so
      they are guards against an over-strict rule, not red steps. Verify: green before 2.4 and
      green after.
- [x] 2.3 Add a failing case for `https://user:pass@example.com` expecting a `link` error. Verify:
      red now, and after 2.4 red again when the `username`/`password` check alone is removed — the
      host there is a valid domain, so only that mutation shows the case is testing userinfo and not
      the host rule.
- [x] 2.4 Implement the rule in `lib/applications/validation.ts`: keep the `new URL()` parse and
      scheme check, add the host regex from design.md and the `username`/`password` check. Verify:
      `npm run test` green, with 2.1 and 2.3 passing and 2.2 still passing.

## 3. The refusal message

- [x] 3.1 Add a failing assertion that a refused link's message describes the shape of a web
      address with an example, rather than only saying the value is invalid. Verify: red against the
      current "Link must be a valid http(s) URL".
- [x] 3.2 Change the message text in `lib/applications/validation.ts` and update the existing
      assertions in `validation.test.ts` and `components/application-form/ApplicationForm.test.tsx`
      that quote the old string. Verify: `npm run test` green with no stale copy of the old text
      (`grep -rn "valid http(s) URL"` returns nothing outside `openspec/changes/archive/`).

## 4. The card does not offer a link it would refuse

- [x] 4.1 Add a case to `components/board/ApplicationCard.test.tsx` for a stored link the new rule
      refuses — a domain-less host, and one with userinfo — asserting the card shows no link
      control. Verify: green, then red when the host check is temporarily removed from
      `isAcceptableLink` — that mutation is what shows the test can fail, since the rule from
      section 2 is already in place by now. This is what backs the shared-rule claim in the
      kanban-board delta.

## 5. The link maximum becomes 512

- [x] 5.1 Change the at-maximum and over-maximum link cases in `validation.test.ts` to 512 so they
      are red against the current 2048. Leave `linkOfLength` alone: it already builds
      `https://example.com/aaa…`, whose host passes the new rule at any length. Verify: red for
      length, not for the host rule — check the error text names the maximum and is not the
      link-shape message.
- [x] 5.2 Change `APPLICATION_LIMITS.link` to 512. Verify: `npm run test` green, and the form's link
      field carries `maxLength="512"` with no change to `ApplicationForm.tsx`.
- [x] 5.3 Update the `link` row of the data model in `spec.md` to 512 and add a Spec change log
      entry: why 512 (2048 was a convention, 512 comes from measured posting addresses), and the new
      host and userinfo rule. Leave the dated 2026-09-29 entry exactly as it is — it is the record
      of what was decided then, and the new entry supersedes it rather than erasing it. Verify: the
      data-model table holds no `2048` (`grep -n 2048 spec.md` returns only the 2026-09-29 log
      entry) and the new entry is dated. Done here, next to 5.2, so the data-model record lands in
      the same commit as the limit it describes.

## 6. The form stops input at each field's maximum

Characterisation, not red-first: the `maxLength` attributes already exist and already work. There
is nothing to drive red here, and writing a test that fails only because it was written wrong would
be theatre. What is missing is coverage — the wiring can be deleted today with the suite staying
green — so these tasks state that openly and name a mutation instead of a red step.

- [x] 6.1 Add a test to `components/application-form/ApplicationForm.test.tsx` asserting each of
      the four fields carries its own limit from `APPLICATION_LIMITS` (120, 120, 512, 2000). Verify:
      green immediately, then red when `maxLength` is temporarily removed from the shared props —
      check that, and put the line back.
- [x] 6.2 Add a test that the form opened on an application whose stored value is longer than the
      field's maximum shows the whole stored value. Assert only that, and say in a comment what this
      test cannot show: the tests stub the action, so a refusal asserted here is the stub's return
      value, and the browser's own blocking of an over-long submit is invisible in jsdom. The
      validator half of that scenario is already covered in `validation.test.ts`. Verify: `npm run
      test` green.
- [x] 6.3 Add a Playwright test that types past a field's maximum with `pressSequentially` and
      asserts both halves of the scenario: the value stopped at the maximum, and no message was
      shown — the stop is required to be silent, and without that assertion a counter could be added
      without failing anything. Verify: `npm run test:e2e` passes, and the test fails when
      `maxLength` is temporarily removed.
- [x] 6.4 Add a Playwright test for the paste half of the same requirement: insert a string longer
      than the maximum in one step with `keyboard.insertText` and assert the value stopped at the
      maximum. Measured in Chromium: `fill()`, `pressSequentially()` and `keyboard.insertText()` all
      respect `maxLength`, and only a direct `value` assignment bypasses it, so any of the three is a
      faithful test — `insertText` is used because it models one insertion of a whole string, which
      is the part of a paste that matters. Verify: `npm run test:e2e` passes, and the test fails when
      `maxLength` is temporarily removed.

## 7. Gates

Mechanical gates first, then the review. A review session must never be the thing that discovers the
artifacts and the code disagree.

- [x] 7.1 Run `npm run verify` — lint, typecheck and unit tests must pass with no errors. Verify:
      exit code 0.
- [x] 7.2 Run `npm run test:e2e`. Verify: exit code 0, including the new 6.3 and 6.4 tests.
- [x] 7.3 Run `openspec verify` (with Node 22 on `PATH`, per AGENTS.md). Verify: no findings, or
      findings fixed and the command re-run.
- [x] 7.4 **Ask the user** whether to launch the `reviewer` agent on the diff, and wait for an
      answer. Do not spawn it. On a yes, launch it only as
      `node .claude/hooks/review.mjs tighten-link-validation --agent reviewer`, with the change name
      and nothing else — no list of things to look at. Verify: the user answered, and on a yes a
      file exists under `docs/reviews/` with an explicit verdict.
- [x] 7.5 Fix anything the review raises, re-run 7.1–7.3, and **ask** before any re-review. Verify:
      both gates green again after the fixes.
