# Proposal review log

Index of the review passes over a **plan** rather than a diff: the `proposal-reviewer` agent
(`.claude/agents/proposal-reviewer.md`) runs after `propose` and before `apply`, on the finished
OpenSpec artifacts of a change where no code has been written yet. It checks scope against
`spec.md`, requirement coverage and testability, whether the proposal's claims about the existing
code still hold, task ordering and red-first compliance, and the design decisions — and it may not
edit the artifacts. This is the first of the two gates `AGENTS.md` → "Independent review"
describes; the second one, the `reviewer` pass over the implemented diff, is indexed separately in
[review-log.md](review-log.md). Each pass lives in its own file under `docs/proposal-reviews/`,
newest last; this file holds one line per pass and never holds findings.

Verdicts follow the gate in the agent definition: **REVISE PROPOSAL** when a Critical or Major
finding stands, **PASS WITH NOTES** when only Minor items or open questions remain, **PASS** when
nothing remains. Minor findings and notes never block. Findings carry `P<date>-<n>` ids, kept
distinct from the code reviewer's `R` ids because the shared disposition ledger
([reviews/decisions.md](reviews/decisions.md)) refers to both.

## Passes

- [2026-10-01 — show-days-in-status](proposal-reviews/2026-10-01-show-days-in-status.md) — REVISE PROPOSAL (0 critical, 1 major, 5 minor)
- [2026-10-02 — flag-stale-applications](proposal-reviews/2026-10-02-flag-stale-applications.md) — REVISE PROPOSAL (0 critical, 1 major, 4 minor)
- [2026-10-02 — tighten-link-validation](proposal-reviews/2026-10-02-tighten-link-validation.md) — REVISE PROPOSAL (0 critical, 2 major, 7 minor)
- [2026-10-02 — show-board-stats](proposal-reviews/2026-10-02-show-board-stats.md) — REVISE PROPOSAL (0 critical, 1 major, 4 minor)
- [2026-10-02 — move-card-by-menu](proposal-reviews/2026-10-02-move-card-by-menu.md) — REVISE PROPOSAL (0 critical, 2 major, 4 minor)
