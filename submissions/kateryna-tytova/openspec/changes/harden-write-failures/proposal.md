# Proposal

## Why

Moving a card can take the whole page down today. `updateApplicationStatus` has no `try`/`catch`
around its `prisma.$transaction`, and `useCardMoves` awaits it bare, so a storage failure — the
database locked, the disk full, the transaction rolled back — is an unhandled rejection inside
`startTransition`. React sends it to the nearest error boundary, which is `app/error.tsx`, and the
board is replaced by "The board could not be loaded — only this page failed to read them": a
message about a failed *read*, for a failed write.

This is the defect the 2026-09-29 review found in the add-application form (`R20260929-1`), in a
path that review's diff never touched. The `kanban-board` spec already promises the opposite —
"A failed move reports the failure and leaves the board truthful" — so this is a requirement that
is not met rather than behaviour nobody specified.

There is a second half, worse than the page going: `setPending` is released *after* the `await`, so
a rejection never releases it. The card stays optimistically moved with its handle disabled, and
nothing short of a reload gets it back.

Now, because MVP item 4 adds the two write paths that have the same hole. `ActionResult` is the type
every caller trusts, and today it is a promise the functions do not keep.

## What Changes

**A server action never throws.** `ActionResult` becomes what its type already claims: every
exported action in `app/actions/applications.ts` returns `{ ok: false, error }` for a failure it
cannot classify, instead of letting it escape. Today `updateApplicationStatus` catches nothing, and
`updateApplication` and `deleteApplication` catch only `P2025` and rethrow the rest.

**The convention moves from `spec.md` into the functions.** "Server actions return `ActionResult`;
data loaders throw" has been written down since 2026-09-27 and enforced by nothing. Putting the
guard in the action makes the type true at the boundary every caller actually crosses.

**A control-flow throw still gets through.** Next signals `redirect()`, `notFound()` and their
siblings by throwing, so a catch-all would swallow them and the redirect would simply not happen.
No action calls one today; the guard goes in now because MVP item 4 is the obvious place somebody
adds a redirect after saving, and the failure would be silent.

**A failed move releases the card.** `useCardMoves` stops leaving a card pending forever when the
write does not resolve into a result.

**The form's wrapper stops carrying its own `catch`.** `createApplicationFromForm` wraps
`createApplication` in `try`/`catch` because the action could throw. Once the action cannot, that
`catch` is dead code, and leaving it would suggest the convention is not trusted.

Not in this change:

- `app/global-error.tsx` for a failure in `app/layout.tsx`, which `app/error.tsx` cannot catch
  because it renders inside it. A real gap, and a different one: it is about where boundaries sit,
  not about what the write paths return.
- Narrowing `app/error.tsx` so a render failure in the board does not also remove the header and
  the "Add application" control.
- Correcting `app/error.tsx`'s message. This is deferred as a *consequence* of the change rather
  than left over by omission. Today the boundary is reached by a failed write, and "only this page
  failed to read them" is then plainly false — that is half of what made `R20260929-1` so bad.
  Afterwards no write reaches it, so the only ways in are a failed read, where the message is
  accurate, and a render bug in a client component, where it is not. The wording goes from wrong
  about a routine, reachable case to wrong only when something is already broken, which is a much
  weaker reason to change it and a sound reason to change it with the boundary work rather than
  here.
- The data loader's own behaviour. `listApplications` keeps throwing; that is the other half of the
  convention and it is working as intended.

## Capabilities

### New Capabilities

<!-- None. This change makes an existing requirement hold in a case it silently did not cover. -->

### Modified Capabilities

- `kanban-board`: "A failed move reports the failure and leaves the board truthful" is strengthened
  to hold for any failure, including one the storage layer raises rather than reports, and to say
  that the card must not be left held after a failure.

## Impact

- **Code**: `app/actions/applications.ts` — all four exported actions gain a catch-all that returns
  `ActionResult`, each beginning with `unstable_rethrow` so Next's own control-flow throws pass
  through; `components/board/useCardMoves.ts` — the pending card is released whatever the write
  does.
- **Server actions**: no signature changes, so no caller changes. `createApplication` keeps the
  shape its tests describe; it gains a failure path those tests never exercised.
- **Data**: no schema change, no migration.
- **Dependencies**: none added.
- **Tests**: `app/actions/applications.test.ts` gains a rejecting case per action, alongside the one
  that already exists for the form wrapper. `components/board/useCardMoves.test.ts` already mocks
  the action through `vi.hoisted`, so the red test for the move path is a `mockRejectedValue`.
  The e2e suite is not extended: a storage failure cannot be provoked in the browser without
  breaking the database the rest of the suite shares.
- **Docs**: the `spec.md` Spec change log records that the convention is now enforced in the
  functions rather than only stated, and `docs/reviews/decisions.md` records that the
  `R20260929-1` class of defect is closed across every write path rather than at the one site the
  review happened to see.
