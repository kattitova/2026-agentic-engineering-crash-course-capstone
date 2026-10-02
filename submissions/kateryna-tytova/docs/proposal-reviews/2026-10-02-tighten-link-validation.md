# 2026-10-02 — tighten-link-validation

**Reviewer:** proposal-reviewer sub-agent (separate session; planner ≠ checker)
**Pass:** first
**Launched:** neutral prompt — the change name and a pointer to this agent definition; no list of things to check
**Reviewed:** `openspec/changes/tighten-link-validation/` — `proposal.md`, `design.md`, `tasks.md`, `specs/application-form/spec.md`, `specs/kanban-board/spec.md`, `.openspec.yaml` — uncommitted (untracked; HEAD `7d6097f`)
**Structural validation:** `openspec validate tighten-link-validation --strict` → `Change 'tighten-link-validation' is valid`
**Implementation state:** not started — no task checked off, no code touched (`git status`: only the change directory is new)
**Verdict:** REVISE PROPOSAL — 0 critical, 2 major, 7 minor

## Previously decided — not re-raised

| Ledger entry | Status | Why it is not raised here |
| --- | --- | --- |
| 2026-09-21 §5 — `href` rendered without a second scheme check | Accepted (fixed in `harden-kanban-board`) | The render-side re-check exists (`ApplicationCard.tsx:90-94`); this change tightens it, it does not reopen it. |
| 2026-09-21 §3/§5 — no maximum field lengths | Resolved in `add-application` | The limits exist (`validation.ts:27-32`); this change lowers one, which is new scope, not the old finding. |

No Deferred entry in `docs/reviews/decisions.md` names this change, so there is no deferral to cash in.

## 1. Scope against `spec.md`

The change narrows a rule MVP item 2 already owns (`spec.md:51`, the `link` row at `spec.md:36`); it adds no user-facing function, and no `prisma/schema.prisma` change is planned (correct: the limits live in `APPLICATION_LIMITS`, `spec.md:43-46`). The new "A field stops accepting input at its maximum" requirement covers all four fields rather than the link alone, but it codifies behaviour that already ships (`ApplicationForm.tsx:67`), so it is coverage, not a second feature.

- **[Minor]** `P20261002-9` `tasks.md:78-80` — task 6.1 has two problems. (a) Its check "no `2048` left in `spec.md`" can only pass by editing the dated 2026-09-29 change-log entry (`spec.md:152-153`: "link at 2048 (the conventional URL ceiling)"). That entry is history. The new entry should supersede it, not erase it. The data-model row (`spec.md:36`, "http(s) only") also gets only the number, and the domain/userinfo rule goes into the log alone. (b) The limit changes in 4.2, and 6.1 comes after the three section-5 tasks. `AGENTS.md` → "Data / Prisma" asks for the `spec.md` record "in the same or the next commit" as the data-model change it describes. Moving 6.1 next to 4.2 fixes the ordering, and scoping the grep to the data-model table fixes the check.

## 2. Requirement coverage and testability

- **[Major]** `P20261002-1` `specs/application-form/spec.md:64-66, 80-83` — the scenario "Pasting a value over the maximum" has no task. The requirement says the stop "SHALL hold for typing and for pasting", but the only browser-level test is 5.3, which types with `pressSequentially` (`tasks.md:71-74`). 5.1 checks the attribute, and jsdom does not apply `maxLength` at all (`design.md:96-99`). `design.md:101-104` names just one Playwright test, "the behaviour the spec scenario names" (singular), and never says the paste case is untestable or why. As written, the change archives a pasting guarantee that nothing has exercised, and a regression that truncates typed input but not pasted input (for example, a future `onPaste` handler that sets `value`) would pass the whole suite. The author has to either add a paste task (clipboard + Ctrl+V, or a measured `keyboard.insertText`; see Open questions) or name the scenario as deliberately untested, with the reason and what covers it instead.
- **[Minor]** `P20261002-4` `proposal.md:49-51` vs `specs/application-form/spec.md:3` — the Capabilities section says this change *modifies* "Stored values are bounded in length" and turns the existing link refusal into a host rule. The delta modifies neither. It **ADDs** two new requirements. After archive, the main spec still has its old definition of a link, the scenario "The link is not a web address … not an http or https address" (`openspec/specs/application-form/spec.md:92-95`), next to the new and stricter one. These don't contradict each other, but the spec then has two places that define a link, and the weaker one reads as complete. Either the proposal text should match the ADDED shape, or the old scenario should be MODIFIED to point at the new requirement.
- **[Minor]** `P20261002-7` `tasks.md:71-74` — the scenario "Typing past the maximum" (`spec.md` delta 75-78) has two clauses: the value is unchanged **and no message is shown**. Task 5.3 checks only the first. The "silently" part of the requirement (`spec.md` delta 68-70) is a deliberate decision, and no test pins it, so adding a counter or a message would not fail anything.
- **[Minor]** `P20261002-8` `tasks.md:67-70` — task 5.2 runs in jsdom, where `ApplicationForm.test.tsx` stubs the action (`refusing(...)`, lines 18-21). There, "submitting it unchanged is refused with a message naming that field" asserts the stub's return value. The part of this trap that can actually break, the browser blocking the submit itself (a `tooLong` state) so that no message ever appears, can't be seen in jsdom. The validator half is already covered by `validation.test.ts:88-96`. The test is still worth having for "shows the whole stored value". The refusal half needs an e2e on a row inserted into `e2e.db` if the scenario is supposed to have real evidence behind it.

## 3. Impact accuracy against the real code

I checked these claims against the code and they hold:

- `isHttpUrl` is `new URL()` plus a protocol test (`lib/applications/validation.ts:65-72`). It has exactly two call sites: `validation.ts:116` and `components/board/ApplicationCard.tsx:11,94`.
- `maxLength: APPLICATION_LIMITS[name]` is on the shared field props (`components/application-form/ApplicationForm.tsx:67`), so a new limit reaches the field with no component change. The link field is `type="text"` (`ApplicationForm.tsx:84, 173-175`), so the browser's own URL check won't get in front of the new message.
- Nothing asserts `maxLength` today (grep across `components/` finds no test assertion).
- The old message string appears at `validation.ts:117`, `validation.test.ts:62`, and `ApplicationForm.test.tsx:142, 294-295`. That matches what 2.2 says.
- There is no `@testing-library/user-event` (`package.json`), and the Playwright version (`^1.63.0`) has `pressSequentially`.
- "No stored row carries a link the new rule would refuse": I read `dev.db` read-only. It holds three links, all `https://jobs.example.com/...`. The `https://test` row from the manual pass is gone. The fixtures in `prisma/seed.ts`, `scripts/seed-e2e.ts` and every unit test (`*.example.com`, `acme.test`, `example.test`) also pass the regex in `design.md:41`.
- No new dependency is needed.

- **[Minor]** `P20261002-3` `tasks.md:3-6, 49-52` — the ordering note says that doing the limit first "would mean writing the 512 boundary against a helper that is about to stop producing acceptable values". That isn't true. `linkOfLength` (`validation.test.ts:76-77`) already builds `https://example.com/aaa…`, whose host passes the new regex at any length. Task 4.1's "Make `linkOfLength` produce a value whose host is a real domain" is therefore a no-op. The Impact wording ("must keep producing", `proposal.md:61-63`) is accurate. Only the task text and the rationale for the order are wrong. Nothing that gets built is affected, which is why this is Minor and not Critical. But an implementer following 4.1 literally will look for a change that doesn't exist.

## 4. Tasks

Red-first is respected for the host rule (1.1/1.3 before 1.4), the message (2.1 before 2.2) and the limit (4.1 before 4.2). Section 5 is openly labelled as characterisation, with a mutation check, and that is the right way to state it. The gates are in the order `AGENTS.md` requires: `npm run verify` (7.1), e2e (7.2), `openspec verify` (7.3), then a review that is *asked for*, with "Do not spawn it" and the bare-name launcher (7.4). The re-review is asked for too (7.5).

- **[Major]** `P20261002-2` `tasks.md:22-28` — task 1.4 renames `isHttpUrl` → `isAcceptableLink` *inside* the feature work, and the call sites only follow in 1.5. That breaks "renames land alone", and it makes 1.4's check unreachable. `ApplicationCard.tsx:11` imports `isHttpUrl` by name and calls it at line 94. Under Vitest a missing named import is `undefined`, not a compile error, so every card test that renders a stored link (`ApplicationCard.test.tsx:46, 81, 118, 208` and others) throws a `TypeError`, and "`npm run test` green" in 1.4 can't happen until 1.5 is done. The implementer will find this mid-section and have to merge or reorder tasks, which leaves a commit that mixes a rename with a rule change, exactly what `AGENTS.md` → "Git / commits" forbids. The split: a rename-only task, either before 1.1 (all callers updated, suite green, behaviour unchanged) or after 3.1. Then 1.4 changes only the rule. (The `validation.ts:116` call site is in the same file as the function, so it can't be a separate step in any case.)
- **[Minor]** `P20261002-5` `tasks.md:15-21` — 1.2 calls its cases "failing", but every listed address is accepted today, so they are green from the start. They are regression guards, and that is how they should be described. 1.3's check "must fail on the userinfo check and not on the host rule" can't be observed at the red step, because neither check exists yet. After 1.4 it needs a mutation (remove the userinfo test and watch the case go red), and the task should say so.
- **[Minor]** `P20261002-6` `tasks.md:42-45` — 3.1's check is "red before 1.4 is in place, green after", but 3.1 comes after 1.4, so it is green as soon as it is written. Either move it before 1.4, or state the mutation that shows it can fail (temporarily restore the old predicate).

## 5. Design decisions

Every decision states the alternative it rejected: the PSL/`tldts` approach, a warning instead of a refusal, one message per cause, and a jsdom-only check of the stop. Nothing is irreversible. The rule is BREAKING for stored data in principle, but I checked the "no stored row affected" claim directly (§3). I also read the regex at `design.md:41` against every host in 1.1–1.3, using the hostnames WHATWG `URL` produces (`a..b`, `.com`, `-.com` and `example.com.` all parse and reach the regex; `[::1]` and `127.0.0.1` fail because the last label isn't alphabetic). The results match the design's claims. Every decision shows up in a task.

No findings.

## Open questions

1. **`fill()` and pasting.** `design.md:104-105` says `fill()` "sets the value directly and would pass whether the attribute is present or not". I couldn't verify this without running a browser. In Chromium, Playwright's `fill` goes through `Input.insertText`, an editing command that may respect `maxlength`. If it does, the claim is wrong in a harmless direction (using `pressSequentially` is still safe), and `keyboard.insertText` may also be a cheap, faithful way to cover the paste scenario in `P20261002-1`. This is worth one measurement before you pick between them.
2. **Underscores and single-character IDN TLDs.** The regex refuses `_` in a label (WHATWG `URL` keeps it in `hostname`), so a host like `careers_eu.example.com` is refused. It also accepts a one-character non-Latin TLD through `xn--` (`.д` → `xn--d1a`) while refusing `a.b`. Neither is in Risks. Both are probably fine for public job postings, so this is your call: name them, or leave them.
3. Section 5 tests a requirement that covers all four fields, under a change named for one of them. If you'd rather keep `tighten-link-validation` strictly about the link, the seam is the boundary between sections 1–4 and section 5. This is not a finding (§1 explains why).

## Must be revised before apply

1. `P20261002-1` (Major) — give the paste scenario a task, or name it as deliberately untested with the reason and what covers it instead.
2. `P20261002-2` (Major) — move the `isHttpUrl` → `isAcceptableLink` rename into its own task, outside the rule change, so that 1.4's "`npm run test` green" is reachable and the rename doesn't share a commit with behaviour.

## Non-blocking suggestions — implementation does not depend on these

- `P20261002-3` — drop or reword 4.1's no-op step and the false ordering rationale in `tasks.md:3-6`.
- `P20261002-4` — make the Capabilities wording match the ADDED-only delta, or MODIFY the old "The link is not a web address" scenario.
- `P20261002-5` — call 1.2's cases regression guards; give 1.3 a mutation check.
- `P20261002-6` — make 3.1's red step reachable or state its mutation.
- `P20261002-7` — have 5.3 also assert that no message appears.
- `P20261002-8` — say what 5.2 can and can't show in jsdom, or add the e2e half.
- `P20261002-9` — keep the 2026-09-29 log entry intact, put the host rule in the data-model row, and place 6.1 next to 4.2.
