# application-delete Specification

## Purpose

Lets the person take an application off the board — a card created by mistake, a role that is no
longer worth tracking — without editing the database, and without a single mis-aimed click
destroying a record there is no way to get back.

## Requirements

### Requirement: Deleting an application is confirmed before it happens

Activating the delete control SHALL NOT delete the application. The system SHALL first ask for
confirmation, naming the application so the person can see which one they are about to lose. Only a
confirmed deletion SHALL be stored.

Confirmation is required because deletion is irreversible: nothing in this tracker restores a
deleted application, so an unconfirmed delete control sitting on every card is one slip away from
losing a record permanently.

#### Scenario: The delete control is activated

- **WHEN** the person activates the delete control on a card
- **THEN** a confirmation is shown that names that application, and the application is not deleted

#### Scenario: Confirmation is declined

- **WHEN** the confirmation is shown and the person declines or dismisses it
- **THEN** nothing is deleted, the card is still on the board, and the board is otherwise unchanged

#### Scenario: Declining twice over

- **WHEN** a confirmation has been declined and the board is reloaded
- **THEN** the card is still there

### Requirement: A confirmed deletion removes the card and is stored

When the person confirms, the application SHALL be deleted from storage and its card SHALL leave
the board without the person reloading the page. The column it was in SHALL show one application
fewer.

#### Scenario: The deletion is confirmed

- **WHEN** the person confirms the deletion of a card in the Applied column
- **THEN** that card is no longer on the board and the Applied count decreases by one

#### Scenario: The deletion is stored, not only shown

- **WHEN** an application has been deleted and the board is reloaded
- **THEN** no card for that application is on the board

#### Scenario: Only that application is deleted

- **WHEN** one of several applications is deleted
- **THEN** every other application is still on the board, each in its own column

### Requirement: A failed deletion is reported and leaves the board truthful

When deleting fails, the system SHALL tell the person that the application was not deleted, and the
card SHALL remain on the board, in the column it was in, because the application is still stored.

This SHALL hold for any failure, including one the storage raises rather than reports: a failure
SHALL NOT remove the board, and SHALL NOT leave the card unable to be deleted or moved afterwards.

#### Scenario: The deletion fails

- **WHEN** a deletion is confirmed and storing the deletion fails
- **THEN** a message says the application was not deleted and the card is still in its column

#### Scenario: The board stays truthful after a failure

- **WHEN** a deletion has failed and the board is reloaded
- **THEN** the card is still there

#### Scenario: The storage fails in a way it cannot describe

- **WHEN** a deletion is confirmed and it fails for a reason the application cannot classify, such
  as the database being unavailable
- **THEN** the board is still shown and a message says the application was not deleted, exactly as
  for a failure the storage does describe

#### Scenario: The card is usable again after a failed deletion

- **WHEN** a deletion has failed
- **THEN** that card can be deleted again and moved again, without the page being reloaded

### Requirement: Deleting an application that is already gone is reported as such

When the application no longer exists — it was deleted in another tab, or directly in the database —
the system SHALL say so rather than reporting an unexplained failure, and SHALL NOT keep a card for
it on the board, because no column is the truthful place for an application that is gone.

#### Scenario: The application no longer exists

- **WHEN** a deletion is confirmed and the application is found to no longer exist
- **THEN** a message says the application was not found and its card is not left on the board,
  without the person having to reload

### Requirement: A deletion in flight cannot be started again

While a confirmed deletion has not finished being stored, the system SHALL NOT accept a second
deletion of the same application, so one confirmation cannot become two writes.

#### Scenario: Confirming twice

- **WHEN** a deletion has been confirmed and that deletion has not finished being stored
- **THEN** that application cannot be deleted again until it has

#### Scenario: Other cards are unaffected

- **WHEN** one application's deletion is being stored
- **THEN** every other card on the board can still be deleted and moved

### Requirement: Deletion is operable without a pointer

Both the delete control and the confirmation SHALL be reachable and operable with the keyboard
alone. While the confirmation is shown, keyboard focus SHALL stay within it, and on dismissal focus
SHALL return to the control that opened it where that control still exists.

#### Scenario: Deleting by keyboard

- **WHEN** the person reaches a card's delete control with the keyboard and activates it, then
  confirms with the keyboard
- **THEN** the application is deleted, exactly as it would be with a pointer

#### Scenario: Focus does not escape the confirmation

- **WHEN** the confirmation is shown and the person moves focus forward past its last control
- **THEN** focus stays within the confirmation rather than reaching the board behind it

#### Scenario: Focus comes back on a declined confirmation

- **WHEN** the confirmation is declined
- **THEN** focus returns to the delete control that opened it

#### Scenario: The confirmation is announced as a question

- **WHEN** the confirmation is shown and the board is read by assistive technology
- **THEN** the confirmation is announced with the name of the application it refers to, not as
  loose text behind the board
