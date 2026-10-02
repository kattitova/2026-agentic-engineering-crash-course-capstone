# Spec Delta

## ADDED Requirements

### Requirement: A card that has gone quiet in Applied is flagged

A card SHALL be flagged as having had no movement when both of these hold: its application's status
is Applied, and it has been in that status for 14 whole days or more.

Both halves are required. An application that has sat in any other column for any length of time
SHALL NOT be flagged: Applied is the one stage where silence carries information, because the
application went out and nothing came back. A card in Wishlist is a bookmark and a card in Rejected
is finished, however old either is.

The age SHALL be the same count the day badge shows, so a card reading 14 days is flagged and a card
reading 13 days is not. Nothing SHALL compute the elapsed time a second way.

#### Scenario: Applied and well past the threshold

- **WHEN** a card's application is in Applied and its status last changed 30 whole days ago
- **THEN** that card is flagged as having had no movement

#### Scenario: Exactly at the threshold

- **WHEN** a card's application is in Applied and its status last changed exactly 14 whole days ago
- **THEN** that card is flagged

#### Scenario: One day short of the threshold

- **WHEN** a card's application is in Applied and its status last changed 13 whole days ago
- **THEN** that card is not flagged

#### Scenario: Old, but in another column

- **WHEN** a card's application has been in Wishlist for 200 whole days
- **THEN** that card is not flagged

#### Scenario: Old in every other column

- **WHEN** a card's application has been in Interview, Offer or Rejected for 200 whole days
- **THEN** that card is not flagged

#### Scenario: Recently moved into Applied

- **WHEN** a card's application moved into Applied today
- **THEN** that card is not flagged

#### Scenario: The flag agrees with the count on the same card

- **WHEN** a flagged card is shown
- **THEN** the day count it shows is 14 or more, and no card showing fewer is flagged

### Requirement: The flag is carried by text, not by colour alone

The flag SHALL be conveyed by visible text. Colour MAY reinforce it but SHALL NOT be the only thing
that distinguishes a flagged card from an unflagged one, because a person who cannot distinguish the
two colours would then have no way to tell them apart.

The flag SHALL also reach assistive technology, announced as what it means rather than as a bare
word standing next to a number.

#### Scenario: Shown without colour

- **WHEN** a flagged card is rendered with its colours removed or unavailable
- **THEN** the flag is still readable as text

#### Scenario: Read by assistive technology

- **WHEN** a flagged card is read by assistive technology
- **THEN** the flag is announced as the application having had no movement, and not as a bare
  number or an unexplained word

#### Scenario: An unflagged card announces nothing extra

- **WHEN** a card that is not flagged is read by assistive technology
- **THEN** nothing about movement is announced for it

### Requirement: The flag does not replace the day count

A flagged card SHALL go on showing how long it has been in its status. The two SHALL remain
distinguishable: the count answers how long, the flag answers whether that is a problem, and one
element carrying both would answer neither clearly.

#### Scenario: A flagged card still shows its count

- **WHEN** a card in Applied whose status last changed 30 whole days ago is shown
- **THEN** it shows both its day count and the flag

#### Scenario: The count is not restyled into the flag

- **WHEN** a flagged card and an unflagged card are shown side by side
- **THEN** both day counts read the same way, and only the flag distinguishes them

### Requirement: The flag follows a move

When a card is moved, its flag SHALL be recalculated from where the card now is and from the reset
clock, without the page being reloaded — a move both changes the status and resets the time in it,
so either half of the rule can stop holding.

Where the move fails, the flag SHALL return with the card: the status was not stored, so neither
half of the rule changed.

#### Scenario: Moved out of Applied

- **WHEN** a flagged card is moved from Applied to Interview
- **THEN** it is no longer flagged, without the board being reloaded

#### Scenario: Moved into Applied

- **WHEN** a card that has been in Wishlist for 200 days is moved into Applied
- **THEN** it is not flagged, because its time in Applied starts at the move

#### Scenario: The move fails

- **WHEN** a flagged card is moved and storing the new status fails
- **THEN** the card returns to Applied and is flagged again

#### Scenario: Dropped in its own column

- **WHEN** a flagged card in Applied is dropped on the Applied column
- **THEN** it is still flagged, because the clock was not reset

### Requirement: The flag does not distort the card or its column

A flagged card SHALL NOT change the width of its column or the position of any other column. The
flag shares the row the day count already occupies.

#### Scenario: A flagged card does not move the columns

- **WHEN** a board is shown with a flagged card in it
- **THEN** every column keeps the width and position it had without the flag, and the page does not
  scroll sideways

#### Scenario: A flagged card with a long company name

- **WHEN** a flagged card's company name is a single very long unbroken word
- **THEN** its column keeps its width and the other columns keep their positions
