# Design

## Context

See proposal.md — Why.

Two facts shape the approach. First, `isHttpUrl` in `lib/applications/validation.ts` is imported by
two call sites with different jobs: `validateApplicationInput`, which decides whether a link may be
stored, and `components/board/ApplicationCard.tsx`, which decides whether to render a stored value
as a link. Tightening the one function moves both at once, which is what the kanban-board delta now
requires of them.

Second, the limits in `APPLICATION_LIMITS` already reach the form on their own:
`ApplicationForm.tsx` sets `maxLength: APPLICATION_LIMITS[name]` on the shared field props. Lowering
the link limit therefore needs no change in the component — which also means nothing in the test
suite would notice if that wiring were removed.

## Goals / Non-Goals

**Goals:**

- One rule for what counts as a link, applied by both the store path and the render path.
- A rule expressible as a predicate over the parsed URL, with no new dependency.
- The form-side stop at the maximum covered by a test, so the wiring cannot be removed silently.

**Non-Goals:**

- Checking that a link resolves, that the host exists, or that the posting is still up. The rule is
  about the shape of an address, not its reachability. A dead link to a real domain stays storable.
- A registry-accurate public-suffix check. See Decisions.
- Any normalisation of the value the person typed. It is stored trimmed, as now, and nothing is
  prepended or lower-cased beyond what `new URL()` already does to the host.

## Decisions

### The host rule is a regex over `URL.hostname`, not a public-suffix list

`new URL()` keeps doing the parse and the scheme check; the new part is a test of `hostname`:

```
/^(?!-)[a-z0-9_-]+(?<!-)(?:\.(?!-)[a-z0-9_-]+(?<!-))*\.(?:[a-z]{2,}|xn--[a-z0-9-]+)$/
```

Read out: one or more labels separated by dots, no label empty or starting or ending with a hyphen,
and a last label that is either two or more letters or a punycode `xn--` label. It was checked
against the full accept and refuse lists in the application-form delta, plus `ftp://`,
`javascript:`, a bare `example.com`, and `https://example.c0m`.

- Why the `xn--` alternative: `new URL()` converts an internationalised host to punycode, so
  `https://приклад.укр` arrives as `xn--80aikifvh.xn--j1amh`. A plain `[a-z]{2,}` last label would
  refuse every non-Latin domain — a rule that reads as correct and silently excludes a whole class
  of real addresses.
- Why underscores are allowed in a label: WHATWG `URL` keeps `_` in `hostname`, and a careers host
  such as `careers_eu.example.com` is a real shape. The DNS hostname grammar does not permit it,
  but a rule that refuses it buys nothing here and would reject an address that resolves.
- Why a trailing dot is refused: `example.com.` is a legitimate fully-qualified name, but it is not
  what anyone pastes out of an address bar, and allowing it would mean the same posting has two
  accepted spellings.
- Why the two-character minimum applies only to Latin script: `a.b` is refused because a
  one-letter last label reads as a typo, and `прикла.д` is accepted even though the root zone has no
  one-character name in any script. The asymmetry is deliberate and bounded.

  An earlier draft tried to close it by length: a one-character name encodes to three characters
  after `xn--` (`д` → `xn--d1a`), real internationalised names to four or more (`укр` →
  `xn--j1amh`), so `xn--[a-z0-9-]{4,}` looked like a measured boundary. It is not one. That holds
  only for low code points: `가` → `xn--o39a`, `컴` → `xn--cf7b`, `한` → `xn--6q8b`, `𠀀` → `xn--j50i`
  are all four characters. Swept over U+0080–U+2FFFF, the threshold admits 105,651 one-code-point
  labels, 23,989 of them in the BMP — every Hangul syllable among them. It would refuse `example.д`
  and accept `example.컴`, which is the script-dependent judgement the rule was supposed to avoid.
  The measurement that produced `{4,}` sampled twelve real names and six one-character ones, and
  every one of the six happened to be low enough to fit the conclusion.

  Answering the question exactly means decoding the punycode label. That is doable without a
  dependency — reading the first variable-length integer with the initial bias and checking the
  string ends there answers "is this exactly one code point", and a prototype agreed with
  `node:punycode` on all 135,964 one-code-point labels and 624 multi-code-point ones. It is
  deliberately not done: no root-zone name is one character, so no address a person can paste
  reaches this case, the only way in is typing a non-existent name by hand, and the cost of the gap
  is one dead link in a tracker whose worst failure is a link that does not open. Fifteen lines of
  punycode arithmetic in a module the client bundle imports (`ApplicationCard.tsx` imports this
  file) is not worth that. So the rule accepts any `xn--` label, and the limit is stated in the spec
  rather than papered over with a threshold that does not hold.
- Alternative considered — the Public Suffix List (via `tldts` or similar): registry-accurate, and
  it would refuse `https://example.invalidtld`, which the regex accepts. Rejected: a new dependency
  with a data file that goes stale, for a tracker whose failure mode is a link that does not open.
  The regex catches every case the manual pass actually found.
- Alternative considered — requiring a scheme and nothing more, with a warning instead of a
  refusal. Rejected: the card has no place to show a warning, and a stored-but-flagged link is a
  third state for the render path to carry.

### Userinfo is refused by checking `username` and `password`, separately from the host rule

`URL` exposes these as their own fields, so this is two equality tests and not a pattern over the
whole address. It is deliberately a separate condition from the host rule: the host in
`https://user:pass@example.com` is a perfectly good domain, so folding this into the host regex
would be hiding one rule inside another.

### The function is renamed to say what it now decides

`isHttpUrl` becomes a lie once the rule is more than "parses, and the scheme is http(s)". Renaming
it to `isAcceptableLink` is a two-call-site change, and it keeps the next reader of
`ApplicationCard.tsx` from assuming the check is only about the scheme. The spec deltas require the
card and the form to share the rule; a name that describes the rule is how that stays obvious.

### 512, and the boundary test keeps a real domain

512 comes from measurement rather than convention: the longest realistic pasted address found was
about 130 characters (a LinkedIn posting with `refId` and `trackingId`), and the longest clean
posting path about 115. 512 leaves room for a longer tracking tail without being a number nobody
could reach.

`linkOfLength` in `validation.test.ts` builds a link of an exact length for the at-maximum and
over-maximum cases. It must keep producing a value whose host is a domain, or the 512 case fails as
"not a link" while appearing to test the length, and the boundary goes unchecked. This is the one
place where the two changes in this proposal interact, which is why the task list puts the limit
change after the rule change.

### The form-side stop is asserted in jsdom, but enforced only in e2e

The component tests drive fields with `fireEvent.change`, which assigns `value` directly and does
not apply `maxLength` — jsdom will happily hold 500 characters in a field capped at 120, and the
project has no `@testing-library/user-event` to type character by character. So a jsdom test
asserting "the value was cut" would be asserting the test helper's behaviour, not the field's.

The split is therefore: the component test asserts that each field carries the right `maxLength`,
which is the wiring that could regress; and Playwright tests in a real browser cover the behaviour
the spec scenarios name — typing past the limit, and pasting past it. The existing
`e2e/long-value-layout.spec.ts` already relies on the interface not being able to produce an
over-limit value; this gives that assumption a test of its own.

Which Playwright call to use was measured rather than assumed, by driving a field with
`maxlength="5"` with ten characters:

```
fill()                 -> "abcde"        respects maxlength
pressSequentially()    -> "abcde"        respects maxlength
keyboard.insertText()  -> "abcde"        respects maxlength
el.value = (direct)    -> "abcdefghij"   BYPASSES maxlength
```

An earlier draft of this design asserted that `fill()` sets the value directly and would therefore
pass with the attribute absent. That is wrong: in Chromium `fill()` goes through `Input.insertText`
and the limit applies. Only a direct assignment to `value` bypasses it — which is exactly what
`fireEvent.change` does, and so is the measurement behind the jsdom point above rather than a
counter-example to it.

`keyboard.insertText()` is what covers the paste scenario. It respects the limit, needs no
clipboard permission, and models an insertion of a whole string in one step, which is the part of a
paste that matters here. A literal `Ctrl+V` would be a closer model and should work in the e2e
suite, where the page is served from `http://localhost` and so is a secure context with the
clipboard API available; the probe above could not test it, because a `data:` URL is not a secure
context. It is worth adding only if `insertText` ever looks too far from a real paste.

### The refusal message

One message for every refused link, as now, rather than one per cause. Naming the specific fault
("the host needs a dot") would mean the validation explaining its own regex to someone who
mistyped. The text describes the target shape instead — the form a web address takes, with an
example — which is what helps the one case we know a person hits by hand: typing `example.com`
without a scheme.

Several causes, one message, is also why the delta's scenarios each assert only that the link field
is identified.

## Risks / Trade-offs

- **A real posting on an unusual host is refused** → Possible in principle: an internal careers
  site reachable only by hostname, or an IP. Accepted deliberately; this tracker is for public job
  postings, and the spec now says so rather than leaving it to the parser.
- **The regex accepts a host with a plausible but non-existent TLD** → `https://example.invalidtld`
  passes. Accepted: the alternative is the dependency rejected above, and the consequence is a link
  that does not open rather than a value that misleads.
- **Allowing `_` admits `https://_.com`** → A label of a single underscore satisfies the rule. This
  is the price of allowing underscores at all: the rule constrains where a hyphen may sit, not what
  a label must contain. `_.com` is not a registrable name, so the consequence is again a link that
  does not open. Accepted rather than patched with a second rule about what a label may consist of.
- **A one-character top-level name written in a non-Latin script is accepted** → `example.д` passes
  while `example.c` is refused. The root zone has no such name, so this is reachable only by typing
  a non-existent address by hand, and the result is a stored link that does not open. Stated in the
  spec rather than closed, with the reasoning in Decisions; the exact fix is a punycode decode, and
  it was measured as possible before being declined.
- **The rename touches the render path, where there is no form to refuse anything** → The card's
  test gains a case for a value the new rule refuses, so the shared-rule claim in the kanban-board
  delta has something behind it rather than resting on the import being the same symbol.
- **The form-side stop is still not a guarantee** → It never was: `maxLength` is absent from
  `prisma/seed.ts` and from a direct call, and a paste set programmatically bypasses it. The
  validation stays the rule; the new requirement says this explicitly so the test for the attributes
  is not read as a test of the limit.

## Migration Plan

None needed. No schema change, and the link column already holds an optional string. No stored row
carries a link the new rule would refuse — this is a development-stage database, which is the
ground on which the proposal drops the compatibility question.
