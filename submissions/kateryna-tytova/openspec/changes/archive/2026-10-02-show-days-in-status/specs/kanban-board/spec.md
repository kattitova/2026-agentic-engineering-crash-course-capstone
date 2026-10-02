# Spec Delta

## ADDED Requirements

### Requirement: A card shows how long its application has been in its status

Each card SHALL show how long its application has been in its current status, counted from the
moment that status was last changed.

The count SHALL be whole elapsed days: a card reads as one day old once a full day has passed since
the status changed, not when the calendar date changes. This is deliberate. A calendar-day count
needs a timezone, and the one the system renders in is not guaranteed to be the viewer's, so the
number could be wrong by one for reasons the person cannot see. Elapsed days cannot be.

The count SHALL be computed from a single instant taken when the board is served, so every card on
one board is counted against the same moment and no card disagrees with another about what "now" is.

#### Scenario: An application that has been in its status for several days

- **WHEN** a card's status last changed 12 whole days ago
- **THEN** its card shows that it has been 12 days in that status

#### Scenario: Less than a day

- **WHEN** a card's status last changed less than a whole day ago
- **THEN** its card says so as today rather than as "0 days"

#### Scenario: Exactly one day

- **WHEN** a card's status last changed exactly one whole day ago
- **THEN** its card shows a singular day, not "1 days"

#### Scenario: A day boundary is not a calendar boundary

- **WHEN** a card's status last changed 20 hours ago, which is on the previous calendar date
- **THEN** its card still reads as today, because a whole day has not passed

#### Scenario: Every card is counted against the same moment

- **WHEN** a board holding several applications is served
- **THEN** each card's count is measured from the same instant, so two applications whose statuses
  changed at the same moment show the same number

### Requirement: The count is never negative and never absent

A stored `statusChangedAt` is not guaranteed to be in the past: the database does not enforce it, so
a clock that has been set back, a hand-edited row or a seed script can put it in the future. A card
in that state SHALL still render, and SHALL NOT show a negative count.

Every card SHALL carry the badge. There is no application without a status and therefore none
without a moment that status was last set, so a card with no badge would mean a rendering fault
rather than an absence.

#### Scenario: The stored moment is in the future

- **WHEN** a card's stored status-changed moment is later than the moment the board was served
- **THEN** its card renders and reads as today, not as a negative number of days

#### Scenario: A very large count does not distort the board

- **WHEN** a card's status last changed several thousand days ago
- **THEN** its card shows that count without widening its column, and the other columns keep their
  positions

#### Scenario: Every card has one

- **WHEN** a board holding applications across several statuses is served
- **THEN** every card shows a count, and no card shows two

### Requirement: The badge is announced as a length of time in a named status

The count SHALL be presented so that assistive technology reads it as a length of time, not as a
bare number. A card otherwise announces two unexplained numbers — its column's count and its own —
with nothing to tell them apart.

The announced form SHALL name the status it refers to. A card's accessible name is its company, and
its status is carried only by the column landmark around it, so "12 days in this status" cannot be
resolved without leaving the card. Naming the status makes the badge answer the question on its own.

#### Scenario: Read by assistive technology

- **WHEN** a card in the Interview column whose status last changed 12 days ago is read by
  assistive technology
- **THEN** the badge is announced as 12 days in Interview rather than as a bare "12"

#### Scenario: The named status follows the card

- **WHEN** a card is moved to another column
- **THEN** its badge is announced with the name of the column it is now in

#### Scenario: The abbreviation is not what is announced

- **WHEN** the badge is shown in a shortened form to fit the card
- **THEN** what is announced is still the full length of time, not the shortened form

### Requirement: Moving a card resets its badge with the move

When a card is moved to another column, its badge SHALL show the application as newly arrived in
that status, without waiting for the page to be reloaded — the move resets the moment the status was
last changed, so a card showing its old count in a new column would be stating something the stored
data contradicts.

Where the move fails, the badge SHALL go back with the card: the status was not stored, so the clock
was not reset either.

#### Scenario: A card is moved

- **WHEN** a card that has been 12 days in Applied is moved to Interview
- **THEN** its card in Interview reads as today, without the board being reloaded

#### Scenario: The move is stored

- **WHEN** a card has been moved to another column and the board is reloaded
- **THEN** its badge still reads as today

#### Scenario: The move fails

- **WHEN** a card that has been 12 days in Applied is moved and storing the new status fails
- **THEN** the card returns to Applied and its badge reads 12 days again

#### Scenario: A card dropped in its own column

- **WHEN** a card that has been 12 days in Offer is dropped on the Offer column
- **THEN** its badge still reads 12 days, because the clock was not reset

### Requirement: The badge reflects the moment the board was served

Every badge on one board SHALL be measured from the instant that board was served, and from no
other. A board left open therefore goes on showing the counts it was served with: the board as a
whole already shows the stored data as of the moment it was served, and a badge that ticked on its
own would be the one thing on the page disagreeing with the rest about what time it is.

#### Scenario: The board is reloaded later

- **WHEN** a board is reloaded after a card's count has increased
- **THEN** the card shows the higher count
