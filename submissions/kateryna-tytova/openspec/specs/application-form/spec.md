# application-form Specification

## Purpose
Lets the person put a job application on the board by hand, so the tracker can be filled in as
applications happen rather than by editing the database.

## Requirements

### Requirement: An application can be added from the board

The board SHALL offer a control that opens a form for adding an application. The form SHALL stay
over the board rather than replacing it, so the person keeps sight of what they are adding to.

#### Scenario: Opening the form

- **WHEN** the person activates the add control on the board
- **THEN** a form for a new application is shown over the board

#### Scenario: Leaving without adding

- **WHEN** the form is open and the person dismisses it without submitting
- **THEN** the form closes, the board is unchanged, and no application is stored

### Requirement: The form collects the company, the role, and optional details

The form SHALL ask for the company and the position, both required, and SHALL offer a link to the
job posting and free-text notes, both optional. It SHALL NOT ask for anything else.

#### Scenario: The fields offered

- **WHEN** the form is open
- **THEN** it offers exactly a company field, a position field, a link field and a notes field,
  and the company and position fields are marked as required

#### Scenario: Only the required fields are filled

- **WHEN** a company and a position are given and the link and notes are left empty
- **THEN** the application is stored with no link and no notes

### Requirement: A stored application appears on the board immediately

When an application is stored, it SHALL appear on the board without the person reloading the page,
and the form SHALL close.

#### Scenario: The application is added

- **WHEN** the form is submitted with a company and a position
- **THEN** the form closes and a card for that application is shown on the board

#### Scenario: A new application starts in the first column

- **WHEN** an application is added
- **THEN** its card is in the Wishlist column, and the Wishlist count increases by one

#### Scenario: The application is stored, not only shown

- **WHEN** an application has been added and the board is reloaded
- **THEN** the card is still there

### Requirement: The form refuses an application it cannot store

The form SHALL NOT submit an application that would be rejected. Where a value is missing or
unusable, the form SHALL say which field is at fault and SHALL keep everything the person has
already typed.

#### Scenario: A required field is empty

- **WHEN** the form is submitted with the company left empty
- **THEN** no application is stored, the form stays open, and a message identifies the company
  field as the one at fault

#### Scenario: Whitespace is not a value

- **WHEN** the form is submitted with a company consisting only of spaces
- **THEN** it is treated as empty and refused in the same way

#### Scenario: The link is not a web address

- **WHEN** the form is submitted with a link that is not an http or https address
- **THEN** no application is stored and a message identifies the link field

#### Scenario: What was typed survives a refusal

- **WHEN** a submission is refused
- **THEN** the values the person entered are still in the form

### Requirement: Stored values are bounded in length

Each field SHALL have a maximum length, and a value longer than its maximum SHALL be refused with a
message naming that field. The maximums SHALL be enforced where the application is validated, not
only in the form, because the form is not the only way a value can reach validation.

#### Scenario: A value over the maximum is refused

- **WHEN** the form is submitted with a company longer than its maximum
- **THEN** no application is stored and a message identifies the company field

#### Scenario: A value at the maximum is accepted

- **WHEN** the form is submitted with a company of exactly the maximum length
- **THEN** the application is stored

#### Scenario: A line break costs one character

- **WHEN** the form is submitted with notes at exactly the maximum length that contain line breaks
- **THEN** the application is stored, and each line break counts as the single character the field
  showed the person while they typed it

### Requirement: A failed write is reported and loses nothing

When storing the application fails for a reason the person cannot see — the database is
unavailable, for instance — the form SHALL stay open with its values intact and SHALL say that the
application was not added.

#### Scenario: The write fails

- **WHEN** the form is submitted and storing the application fails
- **THEN** the form stays open, the values are unchanged, and a message says the application was
  not added

#### Scenario: Nothing is shown that was not stored

- **WHEN** a submission has failed and the board is reloaded
- **THEN** no card for that application is on the board

### Requirement: The form is operable without a pointer

The form SHALL be reachable, completable and dismissable with the keyboard alone. While it is
open, keyboard focus SHALL stay within it, and on dismissal focus SHALL return to the control that
opened it.

#### Scenario: Reaching and completing the form by keyboard

- **WHEN** the person opens the form with the keyboard and moves through it with the keyboard
- **THEN** every field and both the submit and dismiss controls can be reached and used

#### Scenario: Focus does not escape the open form

- **WHEN** the form is open and the person moves focus forward past its last control
- **THEN** focus stays within the form rather than reaching the board behind it

#### Scenario: Focus comes back on dismissal

- **WHEN** the form is dismissed
- **THEN** focus returns to the control that opened it

#### Scenario: A field's message is tied to its field

- **WHEN** a field is refused and the form is read by assistive technology
- **THEN** that field's message is announced as belonging to that field, not as loose text
