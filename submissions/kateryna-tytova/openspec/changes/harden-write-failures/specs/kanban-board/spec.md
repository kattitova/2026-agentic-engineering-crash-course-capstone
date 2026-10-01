# Spec Delta

## MODIFIED Requirements

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
