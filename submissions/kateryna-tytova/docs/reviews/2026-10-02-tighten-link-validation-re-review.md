# 2026-10-02 — tighten-link-validation (re-review)

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** re-review. The working tree changed after `2026-10-02-tighten-link-validation.md`
(CHANGES REQUESTED). `validation.ts`, `validation.test.ts`, `design.md`, `proposal.md`, the
application-form delta spec, `tasks.md` and `spec.md` were all modified after that review was written,
and they are the response to `R20261002-5`.
**Launched:** as a session given the change name plus an instruction to follow the agent definition.
The prompt listed no things to check.
**Reviewed:** the uncommitted working tree against `7d6097f`, focused on the fix diff: the `DOMAIN_HOST`
alternative and its comment, the "accepted" test list, the application-form delta requirement
"A link is a web address with a domain name", the Decisions and Risks sections of `design.md`, and the
`spec.md` change-log entry. **Nothing in this change is committed yet.**
**Verification run:** `npm run verify` (Node 22.13.1) passes: lint, typecheck, and 245/245 unit tests
across 13 files. `npm run test:e2e` was not run because it needs `next build`, which writes build
output. I probed the host rule directly with the same regex and `new URL()` under Node 22, using a
script in the session scratchpad.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 1 minor (carried forward)

## Previously decided — not re-raised

| Item | Ledger status | Why it is not raised here |
| --- | --- | --- |
| `R20260927-7`: the red-then-green order cannot be read out of git history | Declined, closed permanently | It applies again here, because nothing is committed yet. Not raised. |
| `R20260929-3` / `R20261001-3`: commit hygiene, not rewritten | Accepted | Not raised. |

## Status of previous findings

| ID | Status | Evidence |
| --- | --- | --- |
| `R20261002-5` (Major): a one-character top-level name passes in some scripts and fails in others, which contradicts the spec's script-equality requirement | **Fixed** | The author took the spec route the first review left open, and the code, tests and every artifact now agree with it. **Spec:** the "refused whether written as that character or in the encoded form" sentence is gone. The delta now says the two-character minimum SHALL apply to Latin script, and a one-character name in another script MAY be accepted, and it calls this "a stated limit of the rule". The scenario is renamed to "…in Latin script". **Code:** `validation.ts:96` now reads `xn--[a-z0-9-]+`, so whether a punycode last label is accepted no longer depends on its length. **Behaviour, measured:** `https://прикла.д` (`xn--d1a`), `https://a.가` (`xn--o39a`) and `https://example.컴` (`xn--cf7b`) are all accepted. `https://a.b` is refused. `https://приклад.укр`, `https://example.com`, credentials, `localhost`, `127.0.0.1` and a bare word all behave as before. So the non-Latin case no longer splits by script. The only asymmetry left, Latin versus non-Latin, is the one the spec now permits by name. **Claims:** the false "always three characters" measurement is withdrawn in all three places it appeared. The `DOMAIN_HOST` comment, `design.md` Decisions (now with the sweep and the rejected decode prototype) and the `spec.md` change-log entry each state that the length heuristic was wrong. `design.md` Risks lists the gap. **Test:** `прикла.д` moved from the refused list to the accepted list, with a comment that names the gap. Removing the `xn--` alternative makes `приклад.укр` and `прикла.д` fail, so the accepted list still guards against an over-strict rule. |
| `R20261002-6` (Minor): tasks are ticked but nothing is committed, so the §1 rename and the rule share lines | Carried forward unchanged | It was non-blocking and is still true. The tree is still uncommitted. |

## Regressions

None found. The fix only widens what the `xn--` alternative accepts. The card's render path calls the
same `isAcceptableLink`, so the kanban-board requirement that "the card and the form decide by the
same rule" still holds by construction. No existing test changed its expectation apart from moving
`прикла.д`, and the full unit suite is green.

## Open questions

None.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions (shipping does not depend on these)

- `R20261002-6` (Minor, carried forward): commit the change before archive. If the rename can still be
  committed separately, do that, as `tasks.md` §1 intended.
