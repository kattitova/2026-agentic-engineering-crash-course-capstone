# 2026-10-02 — tighten-link-validation

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review — first pass on this change; no earlier review of it exists
**Launched:** with the fixed neutral prompt that `.claude/hooks/review.mjs` builds (change name only).
The prompt listed nothing to check.
**Reviewed:** uncommitted working tree against `7d6097f` — `lib/applications/validation.ts`,
`lib/applications/validation.test.ts`, `components/board/ApplicationCard.tsx`,
`components/board/ApplicationCard.test.tsx`, `components/application-form/ApplicationForm.test.tsx`,
new `e2e/field-limits.spec.ts`, `spec.md`; plus the artifacts under
`openspec/changes/tighten-link-validation/`. **None of this change is committed yet.**
**Verification run:** `npm run verify` — lint, typecheck and 245/245 unit tests pass. `npm run test:e2e`
not run: it needs `next build`, which writes the build output. The host rule was also probed directly
under Node 22 (WHATWG `URL`, the same parser the code uses), with a script in the session scratchpad.
**Verdict:** CHANGES REQUESTED — 0 critical, 1 major, 1 minor

## Previously decided — not re-raised

| Item | Ledger status | Why it is not raised here |
| --- | --- | --- |
| 2026-09-21 §5 — `href` rendered without a second scheme check | Accepted | The render-path re-check is still in place (`ApplicationCard.tsx:93-94`) and now uses the stricter rule. I checked it rather than re-raising it. |
| 2026-09-21 §3/§5 — no maximum field lengths | Resolved in `add-application` | This change only lowers the link limit. I checked the limit and did not raise it again. |
| `R20260927-7` — the red-then-green order cannot be read out of git history | Declined, closed permanently | It applies here too, because nothing is committed. Not raised. |
| `R20260929-3` / `R20261001-3` — commit hygiene, not rewritten | Accepted | Not raised. `R20261002-6` below is about commits that do not exist yet, not about rewriting existing ones. |

## 1. Spec compliance

Each requirement maps to code and tests like this:

- *The form refuses an application it cannot store* (modified link scenario): `validateApplicationInput`
  → `isAcceptableLink`. Both write paths call it (`app/actions/applications.ts:70`, `:151`).
- *A link is a web address with a domain name*: host regex plus the `username`/`password` check in
  `validation.ts:91-119`. The refused cases, accepted cases, userinfo and message tests are in
  `validation.test.ts`.
- *A field stops accepting input at its maximum*: the attributes are asserted in
  `ApplicationForm.test.tsx`, and typing and pasting are covered in `e2e/field-limits.spec.ts`. The test
  for a stored over-limit value is there, and its comment says what jsdom cannot show.
- kanban-board *A card links to the job posting…*: shared function, plus the new card test covering a
  domain-less host and a host with credentials.

I found no code without a requirement behind it.

- **[Major]** `R20261002-5` `lib/applications/validation.ts:91-92` (`DOMAIN_HOST`, the
  `xn--[a-z0-9-]{4,}` alternative) — the requirement "A last label standing for a single character
  SHALL be refused whether it is written as that character or in the encoded form" is not met for
  large, ordinary scripts. The rule assumes that every one-character label encodes to exactly three
  characters after `xn--`. That only holds for low code points. Measured with the same `new URL()`
  call the code makes:
  - `https://a.가` → host `a.xn--o39a` → **accepted**
  - `https://a.𠀀` → `a.xn--j50i` → accepted
  - `https://a.ꙮ` → `a.xn--xx8a` → accepted
  - `https://a.д`, `https://a.ü`, `https://a.中` → refused, as intended

  Across U+0080–U+2FFFF I counted only labels that punycode-decode back to exactly one code point.
  The rule accepts **104,793** of them, **23,156** in the Basic Multilingual Plane. That includes
  every Hangul syllable (U+AC00 onward always encodes to four characters). So `https://example.c` is
  refused while `https://example.컴` is stored. That is the outcome the requirement forbids by name:
  "the same address must not be accepted or refused according to the script it is written in."

  **What the user loses:** someone who mistypes a Korean (or CJK Extension / supplementary-plane)
  top-level name gets no refusal. The dead address is stored, and the card offers it as a working
  link. The same slip in Latin script is caught.

  The tests miss it because the only encoded case is `прикла.д` (`xn--d1a`, three characters). The
  same false claim, "a single-character label always encodes to exactly three characters", appears in
  three places: `design.md` (Decisions, the measured table), the `DOMAIN_HOST` comment, and the new
  `spec.md` change-log entry. This is one defect, reported here once. Either a real length check on the
  decoded label or a spec sentence that states the heuristic's actual limit would close it. Which one
  is the author's call.

## 2. AGENTS.md compliance

No `any`. The logic lives in `lib/`, no `.css` was added, the schema is unchanged, and `spec.md`'s data
model and change log are updated. No pnpm/yarn. Every new interaction has a test.

- **[Minor]** `R20261002-6` (working tree, `lib/applications/validation.ts`) — tasks 1–6 are ticked
  but nothing is committed. `tasks.md` §1 exists so that "no later commit mixes a rename with a
  change of behaviour". In the working tree, the rename (`isHttpUrl` → `isAcceptableLink`) and the new
  rule now touch the same lines of `isAcceptableLink`. They can no longer be split into separate
  commits without temporarily reverting part of the change by hand, because `git add -p` is not
  available here. So the one-commit-per-logical-change intent that the task list itself set up is at
  risk. Users lose nothing.

## 3. Edge cases

- Dragging twice, dropping into the same column, deleting while an action is in flight, and statuses
  outside the enum: this diff does not touch the move or status path. No findings.
- Empty and whitespace-only links: `optionalText` still maps these to `null` before the rule runs.
  Unchanged and covered.
- A very long link: the shape check still comes before the length check. A 600-character value on a
  bad host gets the shape message, which the existing comment says is intended. The 512 boundary
  helper keeps an `example.com` host, as the design requires.
- Probed and behaving correctly: `https://1.2.3.4`, `https://[::1]`, `https://localhost:3000` refused;
  `https://example.123` throws in the parser and is refused; `HTTPS://EXAMPLE.COM` lower-cased and
  accepted; `https://example.com:8080/x` accepted; `https://example.c0m`, `https://a.b-c` refused.
- The single-character TLD gap is `R20261002-5`.

No further findings.

## 4. Test strength

I checked whether each new test would fail if the logic it covers were broken:

- Host refusals: removing `DOMAIN_HOST.test` makes 9 of 11 cases fail.
- Userinfo: the host in the test is valid, so only removing the credentials check fails it, as task
  2.3 intends.
- Message test: red against the old text, because the old text has no `/address/` and no example.
- `APPLICATION_LIMITS` `toEqual`: pins the numbers.
- Card loop: one case per mutation, labelled with the failing value.
- `maxlength` attribute test: fails if the shared prop is removed.
- e2e: asserts the cut value and the silence, and does not depend on jsdom.

No findings beyond the missing high-code-point case, which is part of `R20261002-5`.

## 5. Input safety

The `http(s)` scheme guard is still in place. Both write paths reach it through
`validateApplicationInput`, and the render path re-checks the stored value with the same function
before using it as `href`. Credentials are now refused on both paths. The link is capped at 512 after
trimming, and the other fields' limits are unchanged. `https://@example.com` (empty userinfo) is
accepted. The parser and the browser both resolve it to `example.com`, so the link opens where it
says. No findings.

## 6. Accessibility

The diff makes no change to the UI structure. The new refusal message goes through the existing
field-error wiring (`aria-describedby` and the focus-on-refusal behaviour from `R20260929-2`). No
findings.

## 7. Consistency with earlier features

The `lib/` layout, the `as const satisfies Record<…>` table, and the comment style that explains the
*why* all match earlier work. The rename was applied at both call sites, and `grep isHttpUrl` finds
nothing outside the archive. No findings.

## Open questions

None.

## Blocking follow-ups

1. `R20261002-5` (Major) — a one-character top-level name in Hangul, many CJK ranges and the
   supplementary planes passes the host rule. This contradicts the spec's script-equality
   requirement, and the "always three characters" measurement in `design.md`, the code comment and
   `spec.md` is wrong.

## Non-blocking suggestions (shipping does not depend on these)

- `R20261002-6` (Minor) — commit the change before archive. If the rename can still be committed
  separately, do that, as `tasks.md` §1 intended.
