# Spec Delta

## ADDED Requirements

### Requirement: Moving a card SHALL NOT require a drag gesture

A card SHALL be movable to another column without any drag gesture at all. This is
not a convenience: on a device whose only input is a touchscreen, a drag cannot be
relied on — the browser may claim the gesture for scrolling the moment the finger
moves — and the board's five columns are stacked vertically at that width, so even
a drag that did start would have to cross the length of several screens. A board on
which the status cannot be changed is a board that does not work.

Every card SHALL therefore offer, on the control it already offers for moving, a way
to name the column to move to directly. Choosing a column SHALL produce the same
status change, the same stored result and the same board as dropping the card on
that column.

#### Scenario: A card is moved without dragging

- **WHEN** a card's move control is activated without any dragging and the Interview
  column is chosen
- **THEN** that application's status becomes Interview and the card is shown in the
  Interview column

#### Scenario: The move survives a reload

- **WHEN** a card has been moved by choosing a column and the board is reloaded
- **THEN** the card is still in the column it was moved to

#### Scenario: No pointing device that can press and hold

- **WHEN** the board is used on a device where a press-and-hold drag cannot be
  completed
- **THEN** a card can still be moved to any other column

#### Scenario: The way of moving is not chosen for the person

- **WHEN** the board is opened on any device
- **THEN** every card offers the direct way of naming a column, whether or not
  dragging also works there

### Requirement: The chooser names the card it will move and the columns it can move to

The chooser SHALL identify the application it is about to move, because a board holds
several cards and a chooser naming none of them cannot be acted on with confidence.

It SHALL offer every column the card is not already in, in funnel order. It SHALL
show which column the card is in now, and SHALL NOT offer that column as something
to choose: a move to the column the card already occupies is not a move, and offering
it invites the person to make a change that will do nothing.

#### Scenario: The chooser names the application

- **WHEN** the chooser is opened for a card whose company is "Acme Cloud"
- **THEN** the chooser identifies that application

#### Scenario: The other four columns are offered

- **WHEN** the chooser is opened for a card in the Applied column
- **THEN** Wishlist, Interview, Offer and Rejected are each offered as a destination

#### Scenario: The current column is shown but not offered

- **WHEN** the chooser is opened for a card in the Applied column
- **THEN** Applied is shown as the column the card is in now and cannot be chosen as
  a destination

#### Scenario: Funnel order

- **WHEN** the chooser is opened
- **THEN** the columns it offers appear in funnel order

### Requirement: The chooser can be dismissed without moving the card

Opening the chooser SHALL NOT itself change anything. The person SHALL be able to
dismiss it and leave the application exactly as it was, and dismissing it SHALL NOT
be reported as a failure.

While the chooser is open, the board behind it SHALL NOT be operable, so a choice
cannot be made against a board the person is no longer looking at.

#### Scenario: Dismissed without choosing

- **WHEN** the chooser is opened for a card and then dismissed without a column being
  chosen
- **THEN** the application is unchanged, including the time its status last changed,
  and no message is shown

#### Scenario: Dismissed with the keyboard

- **WHEN** the chooser is open and the dismiss key is pressed
- **THEN** the chooser closes and the application is unchanged

#### Scenario: The board behind is not operable

- **WHEN** the chooser is open
- **THEN** the cards and columns behind it cannot be operated until it is closed

### Requirement: Focus returns to the card after the chooser closes

When the chooser closes, focus SHALL return to the move control of the card it was
opened for, whether a column was chosen or not. A card's move control is inside the
card, and a card that has just moved is re-rendered under a different column, so
focus left anywhere else would strand someone navigating by keyboard at the top of
the page with no way back to where they were.

#### Scenario: Focus after a move

- **WHEN** a card is moved by choosing a column from the chooser
- **THEN** focus is on that card's move control in the column it moved to

#### Scenario: Focus after a dismissal

- **WHEN** the chooser is dismissed without a column being chosen
- **THEN** focus is on the move control of the card it was opened for

### Requirement: A card's move control distinguishes pressing-and-moving from activating

The one control on a card that moves it SHALL support both ways of moving without
either triggering the other. Pressing it and moving SHALL drag the card and SHALL NOT
open the chooser. Activating it without moving SHALL open the chooser and SHALL NOT
start, complete or cancel a move.

A pointer that moves only incidentally — the few pixels a trackpad or an unsteady
hand contributes to what was meant as a click — SHALL be treated as an activation,
not as a drag, because a drag of a few pixels never lands on another column and so
can only have been a misread click.

This requirement is about a pointer. Keyboard activation of the move control SHALL
continue to pick the card up for a keyboard move, as the keyboard requirement
already specifies, and SHALL NOT open the chooser: a keyboard user can reach every
column by that path already, so two keyboard entry points to one move would buy
nothing and could only disagree.

#### Scenario: Pressed and moved

- **WHEN** a card's move control is pressed and the pointer is moved across to
  another column and released
- **THEN** the card moves to that column and the chooser is not shown

#### Scenario: Activated without moving

- **WHEN** a card's move control is pressed and released without the pointer moving
- **THEN** the chooser opens and the application is unchanged

#### Scenario: A click with incidental movement

- **WHEN** a card's move control is pressed and released after the pointer has moved
  only a few pixels
- **THEN** the chooser opens and the application is unchanged

#### Scenario: The keyboard still picks the card up

- **WHEN** a card's move control is focused and activated with the keyboard
- **THEN** the card is picked up for a keyboard move and the chooser is not shown

#### Scenario: The move control is announced as moving its application

- **WHEN** a card's move control is read by assistive technology
- **THEN** it is announced as a control that moves that named application

## MODIFIED Requirements

### Requirement: Moving a card to another column changes the application's status

A card SHALL be movable from one column to another. When it is moved to a different
column, the application's status SHALL become that column's status, and the change
SHALL be stored, not only shown.

This SHALL hold however the move was made. Dropping the card on a column, moving it
with the keyboard and choosing a column directly are three ways of activating one
move, not three moves with their own rules: each SHALL produce the same stored
result, and every guarantee below SHALL apply to all of them.

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

#### Scenario: A card being stored cannot be moved by any means

- **WHEN** a card has been moved and that move has not finished being stored
- **THEN** it can neither be dragged nor moved by choosing a column, so no way of
  activating a move can bypass the hold

#### Scenario: The same failure handling whatever the means

- **WHEN** a move made by choosing a column fails to be stored
- **THEN** the card returns to the column it came from and a failure message is
  shown, exactly as for a failed drop

### Requirement: A card offers controls for editing and deleting its own application

Each card SHALL offer a control that opens its application for editing and a control that deletes
it. Both SHALL be announced as controls rather than as plain text, and both SHALL name the
application they act on, so a column of several cards does not present a row of identically named
controls to someone reading the board by its controls alone.

Neither control SHALL act as a drag source: activating one SHALL NOT start or end a move, and
dragging the card by its drag handle SHALL NOT activate either control. Equally, activating the
card's move control SHALL NOT open either control's own flow — the three controls sit beside each
other, and the move control is the only one of them that answers to more than one gesture, so
which control was reached must never depend on which gesture was used.

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

#### Scenario: A move is not an edit or a deletion

- **WHEN** a card's move control is activated
- **THEN** neither the edit form nor the delete confirmation is shown

#### Scenario: The controls do not distort the card

- **WHEN** a card whose company name is a single very long unbroken word is shown with both
  controls
- **THEN** the card contains that value without widening its column, and the other columns keep
  their positions
