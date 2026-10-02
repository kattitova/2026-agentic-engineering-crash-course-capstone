# Spec Delta

## MODIFIED Requirements

### Requirement: A card links to the job posting when one is stored

When an application has a link to its job posting, the card SHALL offer a way to open that posting.
When no link is stored, the card SHALL show no broken or empty link.

The card SHALL offer a link only when the stored value is an address the form would accept — an
http or https address whose host is a domain name, with no credentials before the host. A stored
value that is not one SHALL be treated as if no link were stored, because a stored address is not
guaranteed to have passed the validation applied when an application is saved.

The card and the form SHALL decide this by the same rule rather than each holding its own. A value
the form refuses must not be presented by the card as something to open, and a value the form
accepts must not be hidden by the card.

Where several cards are shown together, each card's link SHALL identify which application it
belongs to, so a list of links is not a repetition of the same name.

#### Scenario: Application with a link

- **WHEN** an application has a stored job posting link
- **THEN** its card offers a link that opens that posting

#### Scenario: Application without a link

- **WHEN** an application has no stored job posting link
- **THEN** its card shows no link control

#### Scenario: Stored value is not an http address

- **WHEN** an application's stored link uses a scheme other than http or https
- **THEN** its card shows no link control

#### Scenario: Stored value has no domain

- **WHEN** an application's stored link is an http or https address whose host is not a domain name
- **THEN** its card shows no link control

#### Scenario: Stored value carries credentials

- **WHEN** an application's stored link has a username or password before its host
- **THEN** its card shows no link control

#### Scenario: Links are distinguishable across cards

- **WHEN** a column holds several cards that each have a posting link
- **THEN** each link identifies its own application rather than carrying the same name as the
  others
