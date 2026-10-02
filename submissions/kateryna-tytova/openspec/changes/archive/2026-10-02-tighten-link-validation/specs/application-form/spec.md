# Spec Delta

## MODIFIED Requirements

### Requirement: The form refuses an application it cannot store

The form SHALL NOT submit an application that would be rejected. Where a value is missing or
unusable, the form SHALL say which field is at fault and SHALL keep everything the person has
already typed.

This SHALL hold identically whether the form is adding an application or editing one. When an edit
is refused, the stored application SHALL be unchanged, and the form SHALL keep the values the
person typed rather than resetting to the stored ones — the refused values are what they are being
asked to correct.

#### Scenario: A required field is empty

- **WHEN** the form is submitted with the company left empty
- **THEN** no application is stored, the form stays open, and a message identifies the company
  field as the one at fault

#### Scenario: Whitespace is not a value

- **WHEN** the form is submitted with a company consisting only of spaces
- **THEN** it is treated as empty and refused in the same way

#### Scenario: The link is not a web address

- **WHEN** the form is submitted with a link that is not a web address as "A link is a web address
  with a domain name" defines one
- **THEN** no application is stored and a message identifies the link field

#### Scenario: What was typed survives a refusal

- **WHEN** a submission is refused
- **THEN** the values the person entered are still in the form

#### Scenario: A required field is cleared when editing

- **WHEN** the form is submitted on an existing application with the company cleared
- **THEN** the stored application is unchanged, the form stays open, and a message identifies the
  company field as the one at fault

#### Scenario: A refused edit is not reset to the stored values

- **WHEN** an edit is refused
- **THEN** the values the person entered are still in the form, not replaced by the stored ones

#### Scenario: Nothing was changed by a refused edit

- **WHEN** an edit has been refused and the board is reloaded
- **THEN** the card shows the values it had before the refused edit

## ADDED Requirements

### Requirement: A link is a web address with a domain name

A link SHALL be accepted only when it is an http or https address whose host is a domain name. A
host that is a single label with no dot, a host with an empty label, a host whose last label is a
single Latin letter, and a host with a label starting or ending with a hyphen SHALL all be
refused. `localhost` and numeric addresses SHALL be refused by that same rule and SHALL NOT be
exempted: a job posting is not served by the machine running the tracker.

The two-character minimum SHALL apply to a top-level name written in Latin script. A one-character
top-level name written in another script MAY be accepted: no root-zone name is one character in any
script, so no address a person can paste reaches this case, and separating the two means decoding
the host rather than reading it. This is a stated limit of the rule, not a property of addresses.

An underscore in a label SHALL NOT make a link refused: a careers host may carry one, and the
address resolves.

This is stated because being parseable as a URL is weaker than being an address: a value whose host
is a bare word parses, and the card would then offer it as a working link to a posting that cannot
be reached.

A link SHALL also be refused when it carries a username or a password before its host. The host in
such a value is a real domain, so the rule above does not cover it; it is refused because the card
presents a stored link as something to open, and an address with credentials in front of the host
is the shape used to make one domain look like another.

The message for a refused link SHALL describe what a link looks like rather than only stating that
the value is invalid, so a person who entered a bare domain is told what is missing.

#### Scenario: A host with no domain

- **WHEN** the form is submitted with a link whose host is a single word with no dot
- **THEN** no application is stored and a message identifies the link field

#### Scenario: A malformed host

- **WHEN** the form is submitted with a link whose host has an empty label, a label starting or
  ending with a hyphen, or a trailing dot
- **THEN** no application is stored and a message identifies the link field

#### Scenario: A single-character top-level name in Latin script

- **WHEN** the form is submitted with a link whose last label is a single Latin letter
- **THEN** no application is stored and a message identifies the link field

#### Scenario: A host carrying an underscore

- **WHEN** the form is submitted with a link whose host has an underscore in a label and is
  otherwise a domain name
- **THEN** the application is stored with that link

#### Scenario: A local or numeric host

- **WHEN** the form is submitted with a link whose host is `localhost` or a numeric address
- **THEN** no application is stored and a message identifies the link field

#### Scenario: A link carrying credentials

- **WHEN** the form is submitted with a link that has a username or password before its host
- **THEN** no application is stored and a message identifies the link field

#### Scenario: An ordinary posting address is accepted

- **WHEN** the form is submitted with an http or https link whose host is a domain name, with or
  without a path and query
- **THEN** the application is stored with that link

#### Scenario: An internationalised domain is accepted

- **WHEN** the form is submitted with a link whose host is a domain written in a non-Latin script,
  under a real top-level name such as `.укр`, `.рф` or `.中国`
- **THEN** the application is stored

#### Scenario: The message says what a link looks like

- **WHEN** a link is refused
- **THEN** the message names the link field and describes the form a web address takes

### Requirement: A field stops accepting input at its maximum

Each field SHALL stop accepting further input once the value in it has reached that field's
maximum, so a value the validation would refuse for its length cannot be assembled in the form at
all. This SHALL hold for typing and for pasting.

The field SHALL do this silently: no character count and no message. The limits are a guard against
unbounded input rather than a budget the person is expected to manage, and announcing them would
give every field a permanent notice about a case almost nobody reaches.

This SHALL NOT replace the validation. The form is not the only way a value reaches storage, and
the stop is a convenience in front of the rule, not the rule.

#### Scenario: Typing past the maximum

- **WHEN** a field holds a value at its maximum and the person types another character
- **THEN** the value is unchanged and no message is shown

#### Scenario: Pasting a value over the maximum

- **WHEN** the person pastes into a field a value longer than that field's maximum
- **THEN** the field holds the value cut to the maximum

#### Scenario: Every field is bounded in the form

- **WHEN** the form is open
- **THEN** each of the company, position, link and notes fields carries its own maximum, and each
  is the maximum the validation applies to that field

#### Scenario: A stored value already over the maximum

- **WHEN** the form is opened on an application whose stored value is longer than the field's
  maximum
- **THEN** the field shows the whole stored value, and submitting it unchanged is refused with a
  message identifying that field
