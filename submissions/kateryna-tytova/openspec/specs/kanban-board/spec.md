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
