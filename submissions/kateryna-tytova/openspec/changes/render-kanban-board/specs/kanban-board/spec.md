# Spec Delta

## Purpose

Presents saved job applications as a Kanban board, so the person job-hunting can see at a
glance how many applications sit at each stage of the funnel and which company and role each
one refers to, without opening the database.

## ADDED Requirements

### Requirement: Board shows one column per application status

The board SHALL show exactly five columns, one for each application status, in funnel order:
Wishlist, Applied, Interview, Offer, Rejected. The set of columns SHALL be fixed and SHALL NOT
depend on the stored data: a status with no applications still shows its column.

#### Scenario: All five columns are present

- **WHEN** the board is opened
- **THEN** five columns are shown, labelled Wishlist, Applied, Interview, Offer and Rejected,
  in that left-to-right order

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

### Requirement: Each column shows how many applications it holds

Each column SHALL show a count of the applications currently in it, so the shape of the funnel
is readable without counting cards.

#### Scenario: Count matches the cards shown

- **WHEN** the Applied column holds three applications
- **THEN** the Applied column shows the count 3

#### Scenario: Empty column shows zero

- **WHEN** the Offer column holds no applications
- **THEN** the Offer column shows the count 0

### Requirement: A card identifies the company and the role

Each card SHALL show the company name and the position of that application. The company name
SHALL be visually dominant, because applications are recognised by company first.

#### Scenario: Card content

- **WHEN** an application for company "Acme Cloud" and position "Frontend Engineer" is shown
- **THEN** its card shows both "Acme Cloud" and "Frontend Engineer"

### Requirement: A card links to the job posting when one is stored

When an application has a link to its job posting, the card SHALL offer a way to open that
posting. When no link is stored, the card SHALL show no broken or empty link.

#### Scenario: Application with a link

- **WHEN** an application has a stored job posting link
- **THEN** its card offers a link that opens that posting

#### Scenario: Application without a link

- **WHEN** an application has no stored job posting link
- **THEN** its card shows no link control

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

#### Scenario: Data is present on first paint

- **WHEN** the board page is opened
- **THEN** the columns and their cards are already populated with the stored applications

#### Scenario: Data changed elsewhere

- **WHEN** an application's status was changed outside the board and the board page is opened
  again
- **THEN** the card appears in the column matching its new status
