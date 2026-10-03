# Apply notes — move-card-by-menu

Results that live nowhere else: what was checked by hand or by mutation, how, and
what was not checked.

## 6.1 — the chooser on a touch device

**Emulated, not a real device.** One throwaway Playwright run on `devices["Pixel 7"]`
(412×839, real touch events through `tap()`), deleted afterwards, so it is not in CI.

- Tapping `Move Acme Cloud` opens the chooser. Passed.
- Its choice buttons measure **336×44px**. The drag handle they stand in for measures
  26×26px.
- Tapping `Interview` moves the card, the move is stored, and focus is on the card's
  handle afterwards. Passed.

**On a real phone** (reported by the author on 2026-10-03; `npm run dev` served over
the LAN):

- The chooser opens when the handle is tapped. Reported working.
- Choosing a status moves the card between columns. Reported working.
- The move survives a reload. Reported working.
- A finger drag on the handle still fails, as the proposal says it knowingly does: the
  card catches and the page scrolls. This is what `spec.md`'s 2026-10-03 entry rests on,
  so it now rests on an observation and not on the reading of dnd-kit's source.

The device and browser were not recorded.

Still not checked anywhere: WebKit under automation. Focus returning to the handle after
a *dismissal* is guaranteed here by focusing the handle before the chooser opens, because
WebKit does not focus a button on click; both Playwright projects are Chromium, so that
reasoning is untested apart from whatever the phone happens to be running.

**An unexplained first attempt.** The author first saw the page render on the phone with
no button responding. A page loaded by LAN IP from a headless Chromium hydrated and opened
the chooser against the same running dev server, with no console errors, so
`allowedDevOrigins` blocking dev assets - the first hypothesis - was **not** confirmed. The
cause was not found; a stale tab or a page opened before the server was ready is a guess.

## Mutation checks on the e2e tests

A test that has only been seen green has not been shown able to fail. Each of the two
that name a specific failure in their comments was run against the code broken that way
(`--project=wide`; files restored byte-for-byte afterwards, verified with `cmp`):

| Mutation | Expected to fail | Result |
| --- | --- | --- |
| `MoveCardDialog` opens with `show()` instead of `showModal()` | the modality test (5.3) | failed |
| the chooser handler calls `updateApplicationStatus` directly instead of `moveCard` | the failed-write test (5.5) | failed |

The focus tests failed under these mutations as well, which is collateral rather than a
second finding.

The jsdom regression test for the activation distance (4.9) was run red first: without
`activationConstraint: { distance: 5 }` both "tap" tests failed with the heading not
found, and with it they pass.

## Things found on the way

- **Pending async transitions leak between tests.** React runs every async transition
  in flight as one batch, so a status write a test never settles holds back every later
  test's rollback. Two rollback tests passed alone and timed out in the full file. The
  `afterEach` in `Board.test.tsx` settles what a test left pending.
- **`role="alert"` is not unique on the page.** Next renders its own route announcer as
  a second one, so an unscoped `getByRole("alert")` is a strict-mode error. The spec
  scopes to `<main>`.
- **`tabTrail` moved** from `edit-and-delete.spec.ts` to `e2e/tab-trail.ts` so the new
  spec can share it. That is a refactor and belongs in its own commit, apart from this
  change (AGENTS.md → "Git / commits").

## Left open on purpose

- Space's click arrives on `keyup`. dnd-kit calls `preventDefault()` on the pick-up and
  the drop, and `a keyboard move does not open the chooser` passes in Chromium. Firefox
  and WebKit are unverified. See design.md → Open Questions.
