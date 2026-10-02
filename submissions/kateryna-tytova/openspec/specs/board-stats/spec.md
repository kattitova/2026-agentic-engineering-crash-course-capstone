# board-stats Specification

## Purpose

Summarises the whole set of tracked job applications in one line above the board — how many there
are, and what share of them reached the interview stage — so the question "is this job search
working" is answered without counting cards or dividing five column badges in your head.

## Requirements

### Requirement: The summary shows how many applications are tracked

The summary SHALL show the total number of tracked applications, counting every status. That total
SHALL equal the number of cards shown on the board, so the two cannot be read against each other
and disagree.

The total SHALL be presented so that it is understood as a number of applications rather than as a
number standing on its own.

#### Scenario: Applications across several statuses

- **WHEN** fifteen applications are tracked, spread across the five statuses
- **THEN** the summary shows a total of 15

#### Scenario: The total agrees with the board

- **WHEN** the summary and the board are shown together
- **THEN** the total equals the number of cards on the board

#### Scenario: One application

- **WHEN** exactly one application is tracked
- **THEN** the summary names it in the singular, not as "1 applications"

#### Scenario: Nothing is tracked

- **WHEN** no applications are tracked at all
- **THEN** the summary shows a total of zero and no error is shown

### Requirement: The summary shows what share of applications reached the interview stage

The summary SHALL show, as a percentage, the share of tracked applications that reached the
interview stage.

An application SHALL count as having reached the interview stage when its current status is
Interview or Offer, and SHALL NOT count otherwise. The stored data carries only an application's
current status and the moment that status was last set; it carries no history of the statuses an
application passed through. A Rejected application therefore cannot be known to have been
interviewed before it was rejected, and SHALL NOT be counted on the assumption that it was.

The share SHALL be measured against every tracked application, Wishlist included, so the two
figures in the summary describe one and the same set.

Because the figure is narrower than the words "reached interview" suggest on their own, the summary
SHALL make the counted set legible to the person reading it rather than leaving the percentage to
be interpreted. A bare percentage with no indication of what it counts does not satisfy this.

#### Scenario: A share of a mixed board

- **WHEN** fifteen applications are tracked, of which two are in Interview and one is in Offer
- **THEN** the summary shows that 20% reached the interview stage

#### Scenario: An Offer still counts as having reached interview

- **WHEN** an application's status is Offer
- **THEN** it is counted as having reached the interview stage

#### Scenario: A Rejected application is not counted

- **WHEN** an application's status is Rejected
- **THEN** it is not counted as having reached the interview stage, whatever its other stored values

#### Scenario: Wishlist and Applied are not counted but are measured against

- **WHEN** ten applications are tracked, of which five are in Wishlist, four in Applied and one in
  Interview
- **THEN** the summary shows that 10% reached the interview stage

#### Scenario: Nobody has reached interview

- **WHEN** eight applications are tracked and none is in Interview or Offer
- **THEN** the summary shows that 0% reached the interview stage

#### Scenario: Everybody has reached interview

- **WHEN** four applications are tracked and all four are in Interview or Offer
- **THEN** the summary shows that 100% reached the interview stage

#### Scenario: What the percentage counts is readable

- **WHEN** the summary is shown
- **THEN** it is readable from the summary itself which applications the percentage counts, rather
  than only from this document

### Requirement: An empty board shows no percentage

When no applications are tracked, the summary SHALL show no percentage. It SHALL instead indicate
that there is nothing to measure yet, and SHALL NOT show 0%: a share of an empty set is not zero,
and "0% reached the interview stage" is a statement about a job search that has not started.

The summary SHALL still be shown in that state, with its total of zero. A summary that disappears
when the board is empty would read as a rendering fault at the one moment the person has nothing
else on the page to compare it against.

#### Scenario: No applications at all

- **WHEN** no applications are tracked
- **THEN** the summary is shown with a total of zero and shows no percentage

#### Scenario: Not 0%

- **WHEN** no applications are tracked
- **THEN** the summary does not show 0%

#### Scenario: The first application

- **WHEN** no applications are tracked and one is then added
- **THEN** the summary shows a percentage, measured against that one application

### Requirement: The percentage is a whole number that never overstates or erases a case

The percentage SHALL be shown as a whole number. Rounding SHALL NOT cross either boundary of the
range: a percentage SHALL show as 0% only when no application reached the interview stage, and as
100% only when every tracked application did.

Rounding a single success down to 0% would report the opposite of what happened, and rounding a
single remaining application away to 100% would report a job search as finished. Both are reachable
with plausible numbers, so neither is left to ordinary rounding.

#### Scenario: A share that is not a whole number

- **WHEN** three applications are tracked and one is in Interview
- **THEN** the summary shows a whole number of percent, not a fraction

#### Scenario: A single success does not round to nothing

- **WHEN** two hundred and one applications are tracked and exactly one is in Interview
- **THEN** the summary does not show 0%

#### Scenario: A single remaining application does not round away

- **WHEN** two hundred and one applications are tracked and exactly two hundred are in Interview or
  Offer
- **THEN** the summary does not show 100%

#### Scenario: Zero is reserved for zero

- **WHEN** the summary shows 0%
- **THEN** no tracked application is in Interview or Offer

### Requirement: An unrecognised stored status is left out of both figures

If a stored application has a status that is not one of the five known statuses, the summary SHALL
still be shown, and that application SHALL be left out of both figures.

The board already leaves such an application off its columns, because the database does not enforce
the set of statuses. Counting it in the total would make the total disagree with the number of cards
shown, which is the one cross-check the person has.

#### Scenario: One row has an unknown status

- **WHEN** six applications are stored and one of them has a status outside the five known statuses
- **THEN** the summary shows a total of 5 and is shown without an error

#### Scenario: The figures still agree with the board

- **WHEN** an application with an unknown status is stored
- **THEN** the summary's total still equals the number of cards on the board

#### Scenario: It is left out of the share as well

- **WHEN** four applications are stored, one in Interview and one with a status outside the five
  known statuses
- **THEN** the share is measured against the three recognised applications, not the four stored rows

### Requirement: The figures follow a card move or a deletion without a reload

When a card is moved to another column or deleted, the summary SHALL be recalculated from the board
as the person now sees it, without the page being reloaded. A card arriving in Interview while the
percentage above it still reads its previous value would have the page contradicting itself on
screen.

Where the move or the deletion fails, the figures SHALL go back with the card: the change was not
stored, so neither figure changed.

#### Scenario: A card is moved into Interview

- **WHEN** a card is moved from Applied into Interview
- **THEN** the share rises to include it, without the board being reloaded

#### Scenario: A card is moved out of the counted set

- **WHEN** a card is moved from Interview into Rejected
- **THEN** the share falls to exclude it, without the board being reloaded

#### Scenario: A move that changes neither figure

- **WHEN** a card is moved from Wishlist into Applied
- **THEN** both figures are unchanged, because neither status is counted and the total did not change

#### Scenario: A card is deleted

- **WHEN** a card is deleted
- **THEN** the total falls by one and the share is measured against the remaining applications,
  without the board being reloaded

#### Scenario: The last application is deleted

- **WHEN** the only tracked application is deleted
- **THEN** the summary shows a total of zero and no percentage, without the board being reloaded

#### Scenario: A failed move

- **WHEN** a card is moved into Interview and storing the new status fails
- **THEN** the figures read as they did before the move

#### Scenario: A failed deletion

- **WHEN** a card's deletion fails and the card returns to the board
- **THEN** the total reads as it did before the deletion

### Requirement: Both figures are announced as what they mean

Each figure SHALL be presented so that assistive technology reads it as what it measures and not as
a bare number. Two unlabelled numbers side by side above a board that already shows five more
numbers tell a listener nothing.

The percentage SHALL be announced together with what it counts, so it is not heard as a share of
something unspecified.

Each figure SHALL be written out rather than abbreviated. A region spanning the page has room for the
words, so what is shown and what is announced SHALL be one and the same text — there is no second,
shortened form that could drift out of step with it.

#### Scenario: Read by assistive technology

- **WHEN** a summary showing fifteen applications and 20% is read by assistive technology
- **THEN** the total is announced as a number of applications and the percentage as the share that
  reached the interview stage, rather than as "15" and "20"

#### Scenario: The figures are written out

- **WHEN** the summary is shown
- **THEN** each figure carries the words that say what it measures, rather than a bare or abbreviated
  number that something else has to explain

#### Scenario: The empty state is announced

- **WHEN** the summary for an empty board is read by assistive technology
- **THEN** it is announced as there being no applications yet, and not as an empty or missing value

### Requirement: The summary sits above the board and does not distort it

The summary SHALL appear above the board, before the columns in reading order, so it is read first
and is reachable before the cards by keyboard.

The summary SHALL NOT change the width or position of any column, and SHALL NOT cause the page to
scroll sideways, whatever figures it holds.

#### Scenario: Position on the page

- **WHEN** the board page is opened
- **THEN** the summary appears above the columns and comes before them in reading order

#### Scenario: Large figures do not distort the board

- **WHEN** the summary shows a four-digit total
- **THEN** every column keeps the width and position it had, and the page does not scroll sideways

#### Scenario: A narrow viewport

- **WHEN** the board page is opened on a viewport too narrow for five columns side by side
- **THEN** the summary is still shown above the columns and still readable, and the page does not
  scroll sideways
