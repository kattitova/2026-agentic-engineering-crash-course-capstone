# Review log

Index of the independent review passes by a separate agent session (maker ≠ checker), as
required by the Definition of Done in `spec.md`. Each pass lives in its own file under
`docs/reviews/`, newest last; this file holds one line per pass and never holds findings.

A review is followed by a **disposition**, written by the author, accounting for every finding
as resolved, deferred or declined. The standing decisions distilled from those dispositions live
in [reviews/decisions.md](reviews/decisions.md), which the reviewer must read and may not edit —
a finding recorded there is closed and cannot be raised again.

Verdicts follow the gate in `.claude/agents/reviewer.md`: **CHANGES REQUESTED** when a Critical
or Major finding stands, **PASS WITH NOTES** when only Minor items remain, **PASS** when nothing
remains. Minor findings and notes never block. The two review passes below predate the gate, so
their verdicts are retrofitted from their findings.

## Passes

- [2026-09-21 — render-kanban-board](reviews/2026-09-21-render-kanban-board.md) — CHANGES REQUESTED, retrofitted (0 critical, 3 major, 6 minor); includes a pre-implementation risk pass over the `add-drag-and-drop` proposal
- [2026-09-27 — disposition of the 2026-09-21 findings](reviews/2026-09-27-render-kanban-board-disposition.md) — author; all 3 major resolved in `harden-kanban-board`, 1 major deferred to `add-application`, 1 note declined
- [2026-09-27 — harden-kanban-board](reviews/2026-09-27-harden-kanban-board.md) — CHANGES REQUESTED, retrofitted (0 critical, 2 major, 10 minor); the 2026-09-21 count-label fix found ineffective rather than absent
- [2026-09-27 — disposition of the second review pass](reviews/2026-09-27-harden-kanban-board-disposition.md) — author
- [2026-09-27 — harden-kanban-board (re-review)](reviews/2026-09-27-harden-kanban-board-re-review.md) — PASS WITH NOTES (0 critical, 0 major, 2 minor carried forward)
