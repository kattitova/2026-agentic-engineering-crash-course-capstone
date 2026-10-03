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

**Not checked, so 6.1 is not ticked:**

- A real phone. Nothing here has run on iOS or Android.
- That a touch drag *still fails*, as the proposal says it knowingly does. It was not
  observed on the emulation, and a swipe through the emulator is not a finger.
- WebKit. Focus returning to the handle after a *dismissal* is guaranteed here by
  focusing the handle before the chooser opens, because WebKit does not focus a button
  on click; both Playwright projects are Chromium, so that reasoning is untested.

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
