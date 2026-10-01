# Design

## Context

See proposal.md — Why.

What already exists and shapes the approach:

- `ActionResult<T>` is `{ ok: true; data: T } | { ok: false; error: string; fieldErrors? }`. Every
  caller branches on `ok`. Nothing in the type or the functions says a rejection is impossible, and
  three of the four actions can produce one.
- `updateApplicationStatus` awaits `prisma.$transaction` with no `try`/`catch` at all.
  `updateApplication` and `deleteApplication` catch, test for `P2025` through `isRecordNotFound`,
  and `throw error` for everything else. `createApplication` does not catch.
- `createApplicationFromForm` catches, because `R20260929-1` showed what an escaping error costs.
  That is the only place the convention is actually enforced today.
- `useCardMoves` calls the action inside `startTransition`, holds the moved card in a
  `ReadonlySet`, and releases it on the line after the `await`.
- The hook's tests mock the action with `vi.hoisted`, so a rejection is one `mockRejectedValue`
  away. `app/actions/applications.test.ts` already mocks Prisma and `next/cache`.
- `spec.md` states the convention: server actions return `ActionResult`; data loaders throw, and
  `app/error.tsx` catches them.

## Goals / Non-Goals

**Goals:**

- Make `ActionResult` true: an exported action settles, it does not reject.
- Leave every caller and every signature alone, so this is a change of guarantee, not of interface.
- Leave the board usable when a write fails, including the card that failed to move.

**Non-Goals:**

- Changing how a *read* fails. `listApplications` throws on purpose and `app/error.tsx` catches it.
- Where error boundaries sit, how many there are, or what `app/error.tsx` says. Those are real
  problems and a different change.
- Reporting failures to anywhere but the person. No logging service, no error tracking.

## Decisions

### The guard goes in the action, not in the caller

Every exported action in `app/actions/applications.ts` ends in a catch-all that returns
`{ ok: false, error }`.

Alternative considered: catching in each caller, which is what `createApplicationFromForm` does
today. Rejected. It is the pattern that produced this defect: it holds only where somebody
remembered it, and `useCardMoves` did not. Putting it in the action means the guarantee is carried
by the function every caller already trusts, and a future caller — the edit and delete forms of MVP
item 4 — inherits it without knowing the rule exists.

The cost is that `createApplication`'s existing tests describe a function that could throw, and now
cannot. They do not assert that it throws, so they keep passing; the new behaviour arrives as a new
test rather than as a rewritten one.

### Each `try` encloses the storage call and nothing else

`revalidatePath` sits outside it, after the write has succeeded.

Found while implementing: the first version wrapped the write, the revalidation and the return
together. A `revalidatePath` that failed would then have been reported as "the application was not
added" for a row that *was* added — which is the same defect this change describes for a swallowed
`redirect()`, saying the opposite of what happened, in a smaller place.

A cache call that fails after a successful write is a bug, and it should reach the error boundary as
one rather than be dressed up as a storage failure.

### The known failure keeps its own message; the unknown one gets a generic one

`isRecordNotFound` already distinguishes `P2025` and returns "Application not found". That stays,
as does "Invalid application id". The catch-all is for what is left over, and it says only that the
action did not happen, because anything more specific would be a guess about a
`PrismaClientKnownRequestError` code nobody has mapped.

The message each action returns is fixed here rather than left to the implementation, because one
of them is already pinned by a test:

| Action | Message for an unclassified failure |
| --- | --- |
| `createApplication` | `The application was not added. Please try again.` |
| `updateApplicationStatus` | `The move was not saved. Please try again.` |
| `updateApplication` | `The application was not updated. Please try again.` |
| `deleteApplication` | `The application was not deleted. Please try again.` |

`createApplication`'s string is not a choice: `app/actions/applications.test.ts` asserts it exactly,
for the failure that `createApplicationFromForm` currently catches. When that `catch` is removed the
same assertion has to keep passing, which it only does if the action returns that string verbatim.
Picking anything else would break a test that is supposed to be left alone, and the break would look
like the removal was wrong rather than like a message was renamed.

The message does not carry the underlying error's text. A driver message is not written for the
person reading it, and it can carry a file path or a connection string.

Alternative considered: mapping more Prisma codes. Rejected for now — a code is worth mapping when
something in the interface would act on it differently, and nothing does yet.

### A control-flow throw is rethrown before anything is caught

Every catch begins with `unstable_rethrow(error)` from `next/navigation`.

Next signals several things by throwing, and a catch-all swallows them. `redirect()`,
`permanentRedirect()`, `notFound()`, `forbidden()` and `unauthorized()` all work this way, and so do
the request-time APIs (`cookies`, `headers`) when a segment is marked to throw unless it is static.
Next's own documentation states the failure mode: "A `try`/`catch` around the call suppresses the
interrupt and no forbidden UI renders."

Swallowed, a redirect does not happen and leaves no trace but a `console.error` — the action returns
"the application was not updated" for a save that in fact succeeded. That is a worse bug than the
one this change fixes, because it reports the opposite of what happened.

No action calls any of these today, so nothing is broken now. The reason to write the guard anyway
is MVP item 4: a `redirect()` after saving an edit is the obvious thing to add, and the person
adding it would have no way to know that the catch-all two screens down is what made it silently
stop working.

Alternative considered: a rule that these actions must not call a control-flow throw, recorded in
`spec.md`. Rejected. That is the same kind of unenforced convention this change exists to replace,
and it would be enforced by nothing but memory at exactly the moment someone is writing a new form.

`unstable_rethrow` is Next's own answer, and its `unstable_` prefix is the trade-off: the name may
change. One call is cheap to rename, and the alternative is a rule that is free to write and
silently expensive to break.

It lives in the one shared helper every catch delegates to, not repeated at each `catch`. That is the
opposite of what this document first said, and it was changed during implementation for the reason
the risk list below already gives: four catch-alls are four places to get wrong, and a single guard
cannot be forgotten at the fifth. The helper is the first thing each `catch` reaches once the
classified cases have had their turn, so the ordering the guard needs still holds.

### `console.error` in the catch, and nothing else

The thrown error is the only record of what went wrong, and swallowing it silently would trade a
visible crash for an invisible one. `app/error.tsx` already does exactly this for the read path, so
the shape is not new.

This is server-side output, so it reaches the terminal rather than the person.

### The pending card is released whatever happens

`useCardMoves` moves the release into a `finally`, so a card is never left held. With the actions no
longer rejecting, this is belt and braces — but it is the half of the defect that survives a reload
of nothing, and the hook should not depend on an invariant held somewhere else to avoid leaving the
interface stuck.

It also gains a `catch` that reports the failure, which this document did not originally call for.
The `finally` alone would release the card and say nothing, and the rejection would still travel to
the error boundary and take the board. For the same reason as the `finally`: the cost of being wrong
about the action's guarantee is the whole board, so the hook holds its own. The message is a copy of
the action's rather than an import, because a `"use server"` file can only export async functions —
a forced duplication, and the one place a drifting string would go unnoticed.

`useOptimistic` needs no equivalent: the optimistic value is derived from the server list each
render, so it unwinds when the transition ends.

### The form wrapper's `catch` is removed

`createApplicationFromForm` has no reason to catch once `createApplication` cannot throw, and
leaving it would say the convention is not trusted. Its test stays: it asserts the *result* of a
failed write, which is still exactly what the wrapper returns — now because the action produced it
rather than because the wrapper caught it.

That makes the test weaker in one respect, since it would pass with the guard in either place. The
new test on `createApplication` itself is what pins the guarantee where it now lives.

## Risks / Trade-offs

- **A bug can now be returned as "the move did not happen" instead of crashing** → accepted, with
  `console.error` as the mitigation. A `TypeError` from our own code in an action reaches the person
  as a failure message rather than a stack trace. In exchange, a database that is briefly locked no
  longer removes the board. The server log keeps the stack.
- **Four catch-alls is four places to get wrong** → accepted. A shared wrapper was considered and
  set aside: it would need to preserve each action's own early returns and its `P2025` handling, so
  it would be a higher-order function wrapping four functions with different shapes, which is more
  to understand than the line it replaces.
- **`unstable_rethrow` may be renamed** → accepted. It is Next's own API for this and the only one;
  the prefix marks the name, not the behaviour. Four call sites, one import, and a typecheck
  failure on upgrade is a loud way to find out.
- **"The card returns to its original column" is asserted but not pinned** → recorded rather than
  mitigated. The scenario for an unclassifiable failure says it behaves exactly as a reported one,
  and the test asserts all three clauses. The column clause has no mutation that kills it alone:
  hoisting the optimistic move out of the transition breaks nothing, and replacing `useOptimistic`
  with plain state fails a neighbouring test first. The behaviour is `useOptimistic` unwinding, which
  other tests already hold. The assertion stays for what it does do — make the requirement's three
  clauses readable in one place — and not as evidence. Only a provoked storage failure in a browser
  would be evidence, which the next item rules out.
- **No e2e coverage** → accepted and recorded. Provoking a storage failure in the browser means
  breaking the database the whole suite shares, and the suite's own guarantee is that it leaves that
  database as it found it. The unit tests mock the storage, which is the level the failure lives at.

## Open Questions

None. The one that would have changed the shape of this work — whether the guard belongs in the
action or in the caller — was settled before the change was written, together with the scope: all
four actions, not only the one with a live caller, because a convention that holds for half the
actions is the state that caused this.
