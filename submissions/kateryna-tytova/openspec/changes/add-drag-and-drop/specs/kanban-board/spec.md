# Spec Delta

## ADDED Requirements

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

### Requirement: A failed move returns the card and reports the failure

When storing the new status fails, the board SHALL return the card to the column it came from
and SHALL tell the person that the move did not happen. The board SHALL NOT keep showing a
position that the stored data does not have.

#### Scenario: The write fails

- **WHEN** a card is moved to another column and storing the new status fails
- **THEN** the card returns to its original column and a failure message is shown

#### Scenario: The board stays truthful after a failure

- **WHEN** a move has failed and the board is reloaded
- **THEN** the card is in the column it occupied before the failed move

### Requirement: A card can be moved with the keyboard

Moving a card SHALL NOT require a pointing device. A card SHALL be reachable with the keyboard,
and SHALL be movable to another column with the keyboard alone, producing the same status change
as a pointer drag.

#### Scenario: Keyboard move

- **WHEN** a card is focused with the keyboard and moved to the next column using the keyboard
- **THEN** the application's status changes exactly as it would after a pointer drag

#### Scenario: Card is reachable

- **WHEN** the board is navigated with the keyboard
- **THEN** each card's move control can be reached and is announced as a control, not as plain
  text
