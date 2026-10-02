# kanban-board Specification

## Purpose

Presents saved job applications as a Kanban board, so the person job-hunting can see at a
glance how many applications sit at each stage of the funnel and which company and role each
one refers to, without opening the database.

## Requirements

### Requirement: Board shows one column per application status

The board SHALL show exactly five columns, one for each application status: Wishlist, Applied,
Interview, Offer, Rejected. The set of columns SHALL be fixed and SHALL NOT depend on the stored
data: a status with no applications still shows its column.

On a wide viewport the five columns SHALL be laid out side by side in funnel order, left to right.
Below that width the columns MAY wrap onto several rows; their funnel order SHALL be preserved in
reading order. The left-to-right guarantee is therefore a wide-viewport guarantee, not an
unconditional one.

#### Scenario: All five columns are present

- **WHEN** the board is opened
- **THEN** five columns are shown, labelled Wishlist, Applied, Interview, Offer and Rejected

#### Scenario: Funnel order on a wide viewport

- **WHEN** the board is opened on a wide viewport
- **THEN** the five columns appear side by side in the order Wishlist, Applied, Interview, Offer,
  Rejected, left to right

#### Scenario: Narrow viewport keeps the order

- **WHEN** the board is opened on a viewport too narrow for five columns side by side
- **THEN** the columns wrap onto several rows and still follow funnel order in reading order

#### Scenario: A status with no applications still has a column

- **WHEN** no application has the status Offer
- **THEN** the Offer column is still shown, in its usual position

#### Scenario: The board is empty

- **WHEN** no applications are stored at all
- **THEN** all five columns are shown, each in its empty state, and no error is shown

### Requirement: Each application appears in the column for its current status

Every stored application SHALL appear exactly once on the board, in the column that matches its
current status. No application SHALL be hidden or duplicated.

#### Scenario: An application is placed by its status

- **WHEN** an application has the status Interview
- **THEN** that application is shown in the Interview column and in no other column

#### Scenario: Every stored application is shown

- **WHEN** the board is opened with applications stored across several statuses
- **THEN** the number of cards on the board equals the number of stored applications

### Requirement: The board tolerates an unrecognised stored status

If a stored application has a status that is not one of the five known statuses, the board SHALL
still render. That application MAY be left off the board, but its presence SHALL NOT prevent the
other applications from being shown.

The stored status is not guaranteed to be one of the five: the database does not enforce the set,
so a seed script, a hand edit or a future migration can introduce a value the board does not know.
One such row must cost at most one card, never the page.

#### Scenario: A stored application has an unknown status

- **WHEN** the board is opened and one stored application has a status outside the five known
  statuses
- **THEN** all five columns are shown with every other application in its column, and no error
  page is shown in place of the board

#### Scenario: Known applications are unaffected

- **WHEN** the board is opened with one unknown-status application and three known ones
- **THEN** the three known applications are each shown in the column matching their status

### Requirement: Each column shows how many applications it holds

Each column SHALL show a count of the applications currently in it, so the shape of the funnel is
readable without counting cards. The count SHALL be presented so that it is understood as that
column's count, and not as a number standing on its own, when the board is read by assistive
technology.

#### Scenario: Count matches the cards shown

- **WHEN** the Applied column holds three applications
- **THEN** the Applied column shows the count 3

#### Scenario: Empty column shows zero

- **WHEN** the Offer column holds no applications
- **THEN** the Offer column shows the count 0

#### Scenario: The count is announced with its column

- **WHEN** the Applied column holds three applications and the board is read by assistive
  technology
- **THEN** the count is announced as a number of applications rather than as a bare "3"

### Requirement: A card identifies the company and the role

Each card SHALL show the company name and the position of that application. The company name SHALL
be visually dominant, because applications are recognised by company first.

A card SHALL remain readable whatever the stored values are. A long company name or position SHALL
wrap or be shortened within the card, and SHALL NOT change the width of its column or the layout of
the board.

#### Scenario: Card content

- **WHEN** an application for company "Acme Cloud" and position "Frontend Engineer" is shown
- **THEN** its card shows both "Acme Cloud" and "Frontend Engineer"

#### Scenario: A very long value does not distort the board

- **WHEN** an application whose company name is a single very long unbroken word is shown
- **THEN** its card contains that value without widening its column, and the other columns keep
  their positions

### Requirement: A card links to the job posting when one is stored

When an application has a link to its job posting, the card SHALL offer a way to open that posting.
When no link is stored, the card SHALL show no broken or empty link.

The card SHALL offer a link only when the stored value is an http or https address. A stored value
that is not one SHALL be treated as if no link were stored, because a stored address is not
guaranteed to have passed the validation applied when an application is saved.

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

#### Scenario: Links are distinguishable across cards

- **WHEN** a column holds several cards that each have a posting link
- **THEN** each link identifies its own application rather than carrying the same name as the
  others

### Requirement: An empty column explains that it is empty

A column with no applications SHALL show a short message in place of its cards, so an empty
column reads as "nothing here yet" rather than as a rendering fault.

#### Scenario: Empty column message

- **WHEN** the Rejected column holds no applications
- **THEN** the Rejected column shows a short empty-state message instead of a blank area

### Requirement: The board reflects the stored data when it is opened

The board SHALL show the applications as they are stored at the moment the page is served. It
SHALL NOT require any user action to load the data, and SHALL NOT show a loading placeholder in
place of the columns.

The stored data SHALL be read when the page is requested, not when the application is built. A
board built once and served unchanged afterwards does not satisfy this requirement, because it
shows the data as it was at build time.

#### Scenario: Data is present on first paint

- **WHEN** the board page is opened
- **THEN** the columns and their cards are already populated with the stored applications

#### Scenario: Data changed elsewhere

- **WHEN** an application's status was changed outside the board and the board page is opened
  again
- **THEN** the card appears in the column matching its new status

#### Scenario: Data changed after the application was built

- **WHEN** an application is added or changed outside the board after the application was built,
  and the board page is then opened
- **THEN** the board shows that change without the application being built again

### Requirement: Moving a card to another column changes the application's status

A card SHALL be movable from one column to another. When it is dropped on a different column,
the application's status SHALL become that column's status, and the change SHALL be stored, not
only shown.

#### Scenario: Card dropped on another column

- **WHEN** a card in the Applied column is dropped on the Interview column
- **THEN** that application's status becomes Interview and the card is shown in the Interview
  column

#### Scenario: The move survives a reload

- **WHEN** a card has been moved to another column and the board is reloaded
- **THEN** the card is still in the column it was moved to

#### Scenario: Column counts follow the move

- **WHEN** a card is moved from Applied to Interview
- **THEN** the Applied count decreases by one and the Interview count increases by one

#### Scenario: A card cannot be moved again while its move is being stored

- **WHEN** a card has been moved and that move has not finished being stored
- **THEN** that card cannot be moved again until it has, so two moves of one card cannot settle
  out of the order they were made in

#### Scenario: Other cards stay movable

- **WHEN** one card's move is being stored
- **THEN** every other card on the board can still be moved

### Requirement: The first move into Applied records the application date

The first time an application's status becomes Applied, the system SHALL record the date it was
applied to. A later move into Applied SHALL NOT overwrite that date, so the original application
date is never lost by moving a card around.

#### Scenario: First move into Applied

- **WHEN** an application that has never been Applied is moved into the Applied column
- **THEN** its application date is set to the moment of the move

#### Scenario: Moving into Applied again

- **WHEN** an application that already has an application date is moved into Applied again
- **THEN** its original application date is unchanged

### Requirement: Dropping a card in its own column changes nothing

When a card is released over the column it already belongs to, the system SHALL treat it as no
change: the status stays the same and the time the status last changed is not reset, so a
cancelled or misjudged drag cannot restart the "time in this status" clock.

#### Scenario: Card dropped on its own column

- **WHEN** a card in the Offer column is dropped on the Offer column
- **THEN** the application is unchanged, including the time its status last changed

#### Scenario: Drag cancelled

- **WHEN** a drag is started and then cancelled without dropping on a column
- **THEN** the card returns to its column and the application is unchanged

### Requirement: A failed move reports the failure and leaves the board truthful

When storing the new status fails, the board SHALL tell the person that the move did not happen,
and SHALL NOT keep showing a position that the stored data does not have. Where the application
still exists, the card SHALL return to the column it came from. Where the application no longer
exists, the card SHALL NOT be restored, because no column is the truthful one for an application
that is gone.

This SHALL hold for any failure, including one the storage raises rather than reports. A failure
SHALL NOT remove the board, and SHALL NOT leave the moved card held: once a move has failed, that
card SHALL be movable again without the page being reloaded.

#### Scenario: The write fails

- **WHEN** a card is moved to another column and storing the new status fails while the
  application still exists
- **THEN** the card returns to its original column and a failure message is shown

#### Scenario: The board stays truthful after a failure

- **WHEN** a move has failed and the board is reloaded
- **THEN** the card is in the column it occupied before the failed move

#### Scenario: The application was deleted while the move was in flight

- **WHEN** a card is moved and the application is found to no longer exist
- **THEN** a failure message is shown and the card is not left on the board, without the person
  having to reload

#### Scenario: The storage fails in a way it cannot describe

- **WHEN** a card is moved and storing the new status fails for a reason the application cannot
  classify, such as the database being unavailable
- **THEN** the board is still shown, the card returns to its original column, and a failure
  message is shown, exactly as for a failure the storage does describe

#### Scenario: A card can be moved again after a failed move

- **WHEN** a move has failed and the person moves the same card again
- **THEN** the card can be picked up and moved, without the page being reloaded

### Requirement: A card can be moved with the keyboard

Moving a card SHALL NOT require a pointing device. A card SHALL be reachable with the keyboard,
and SHALL be movable to another column with the keyboard alone, producing the same status change
as a pointer drag.

#### Scenario: Keyboard move

- **WHEN** a card is focused with the keyboard and moved to the next column using the keyboard
- **THEN** the application's status changes exactly as it would after a pointer drag

#### Scenario: One key press moves one column

- **WHEN** a card has been picked up with the keyboard and the key for the next column is pressed
  once
- **THEN** the card is over the adjacent column in funnel order, whatever the width of the
  columns

#### Scenario: Card is reachable

- **WHEN** the board is navigated with the keyboard
- **THEN** each card's move control can be reached and is announced as a control, not as plain
  text

### Requirement: A card offers controls for editing and deleting its own application

Each card SHALL offer a control that opens its application for editing and a control that deletes
it. Both SHALL be announced as controls rather than as plain text, and both SHALL name the
application they act on, so a column of several cards does not present a row of identically named
controls to someone reading the board by its controls alone.

Neither control SHALL act as a drag source: activating one SHALL NOT start or end a move, and
dragging the card by its drag handle SHALL NOT activate either control.

#### Scenario: Both controls are on the card

- **WHEN** a card is shown
- **THEN** it offers a control for editing that application and a control for deleting it

#### Scenario: The controls name their application

- **WHEN** a column holds several cards
- **THEN** each card's edit and delete controls identify their own application rather than carrying
  the same name as the others

#### Scenario: The controls are reachable by keyboard

- **WHEN** the board is navigated with the keyboard
- **THEN** each card's edit and delete controls can be reached and are announced as controls

#### Scenario: A control is not a drag

- **WHEN** a card's edit control is activated
- **THEN** the application's status is unchanged and no move is recorded

#### Scenario: The controls do not distort the card

- **WHEN** a card whose company name is a single very long unbroken word is shown with both
  controls
- **THEN** the card contains that value without widening its column, and the other columns keep
  their positions

### Requirement: The board reports a failed edit or deletion where the person is looking

A failure to edit or delete SHALL be reported to the person without the page being replaced by an
error. Where the form is open, the form SHALL carry the message, because that is where the person's
attention is. Where no form is open — a deletion confirmed and failed — the board SHALL carry it,
announced so that it interrupts rather than waiting to be noticed.

#### Scenario: A failed deletion is announced

- **WHEN** a confirmed deletion fails
- **THEN** a message is shown on the board and announced, and the board itself is still shown

#### Scenario: One failure does not hide the next

- **WHEN** a deletion has failed and a second deletion of another card then fails
- **THEN** the second failure is reported too rather than being taken for the first

#### Scenario: A succeeded action clears the message

- **WHEN** a deletion has failed and a later deletion succeeds
- **THEN** the failure message is no longer shown

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
