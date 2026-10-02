# Proposal

## Why

A manual pass over the form found that `https://test` is stored as a job posting link. The check
behind the link field is `new URL()` plus a protocol test, and that pair only asks whether a value
is *syntactically* a URL — any non-empty host satisfies it, so `http://a`, `https://.com` and
`https://-.com` all pass as well. The card then renders the value as a working link, which it is
not. Nothing in the spec ever required the host to be a domain, so this is a gap in the rule rather
than a bug in its implementation.

The same pass asked why the link field accepts 2048 characters. That number was taken as the
conventional ceiling for a URL, not from anything this tracker stores: measured against real job
postings, the longest realistic address — a LinkedIn link copied from the address bar, with its
`refId` and `trackingId` — is about 130 characters. 2048 is sixteen times what the field needs.

## What Changes

- **BREAKING** (rule, not data) A link SHALL be accepted only when its host is a domain name: it
  must contain a dot, its last label must be at least two Latin letters or a punycode `xn--` label,
  and no label may be empty or start or end with a hyphen. This refuses `https://test`,
  `http://a`, `https://.com`, `https://a..b`, `https://-.com`, `https://a.b` and
  `https://example.com.`, which are accepted today. The two-character minimum reaches only Latin
  script: `https://прикла.д` stays accepted, because telling a one-character name from a real one
  in punycode means decoding the host, and no root-zone name is one character in any script — so
  nothing a person can paste reaches that case. The limit is stated in the capability spec.
- An underscore in a label does not make a link refused. `https://careers_eu.example.com` is a real
  careers host, `URL` keeps the underscore in the host, and the address resolves.
- `localhost`, IPv4 and IPv6 hosts are refused by that same rule and deliberately not exempted — a
  job posting does not live on the machine running the tracker.
- A link carrying userinfo (`https://user:pass@example.com`) is refused. The host is honest there,
  so the domain rule alone would not catch it; it is refused because the card renders the value as
  a link and that form is the classic phishing shape.
- The link maximum drops from 2048 to 512 characters. 512 keeps a pasted address with tracking
  parameters intact with room to spare, at a quarter of the previous ceiling.
- The link field's refusal message stops being "Link must be a valid http(s) URL" and names what a
  link looks like instead, so a person who typed `example.com` by hand is told what is missing.
- The form's existing per-field `maxLength` attributes become a stated requirement with a test
  behind them. They are already there and already work; nothing is being added to the interface.

Explicitly **not** changing: the field stops accepting input silently at its maximum, with no
character counter and no message. That was considered and kept as it is. Nor is `https://` prepended
to a scheme-less value — the normal path is a paste of a complete address, and prepending would need
its own normalisation on two levels and would make the maximum measure a value the person never
typed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `application-form`: two requirements are **added** — "A link is a web address with a domain name",
  which states the host rule and the refusal of userinfo, and "A field stops accepting input at its
  maximum", which states the form-side stop that already ships. One requirement is **modified** —
  "The form refuses an application it cannot store", whose scenario "The link is not a web address"
  now defers to the added rule instead of carrying its own weaker definition of a link. Without
  that, the archived spec would define a link twice and the weaker definition would read as
  complete.
- `kanban-board`: the requirement "A card links to the job posting when one is stored" decides
  whether to render a link by the same validity rule the form applies, so a value the form would
  refuse is not shown as a working link by the card.

## Impact

- `lib/applications/validation.ts` — `isHttpUrl` gains the host rule and the userinfo refusal;
  `APPLICATION_LIMITS.link` drops to 512; the link message text changes.
- `lib/applications/validation.test.ts` — new cases for the refused hosts and for userinfo. The
  existing `linkOfLength` helper (around line 76) builds a link of an exact length to test the
  boundary, already on `https://example.com/`, whose host passes the new rule at any length. It
  needs no change; it must simply not be changed to a host the new rule refuses, or the 512
  boundary case would fail for the wrong reason and the boundary would go unchecked.
- `components/application-form/ApplicationForm.tsx` — no code change expected: `maxLength` is
  already wired to `APPLICATION_LIMITS`, so the new link limit reaches the field on its own.
- `components/application-form/ApplicationForm.test.tsx` — a test that the four fields carry the
  limits, which nothing asserts today.
- `components/board/ApplicationCard.tsx` — the import and call are renamed with the function; the
  card inherits the stricter rule without any change to what it does. Its test gains a case for a
  value the new rule refuses.
- `e2e/` — one spec covering the form-side stop in a real browser, for typing and for pasting.
  jsdom cannot show either: `fireEvent.change` assigns `value` directly, which is the one way
  measured to bypass `maxLength`.
- `spec.md` — the `link` row in the data model, and an entry in the Spec change log recording why
  2048 became 512.
- No database or Prisma change: the column is already `String?` and holds whatever validation
  passes. No stored row currently carries a link the new rule would refuse, so nothing needs
  migrating.
