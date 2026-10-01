# Spec Delta

## ADDED Requirements

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
