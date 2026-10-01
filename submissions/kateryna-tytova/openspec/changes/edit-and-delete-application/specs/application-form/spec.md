# Spec Delta

The five requirements below are modified rather than paired with edit-only twins: validation, the
length maximums, the failure report and keyboard operability are identical in both modes, and
stating them twice would be two places free to drift. Only behaviour that exists solely when
editing is added as a new requirement.

## MODIFIED Requirements

### Requirement: The form collects the company, the role, and optional details

The form SHALL ask for the company and the position, both required, and SHALL offer a link to the
job posting and free-text notes, both optional. It SHALL NOT ask for anything else.

The same four fields SHALL serve both adding an application and editing one. In particular the form
SHALL NOT offer the application's status: status is changed by moving the card, which is also what
decides the application date and the time the status last changed. A form that could set status
would give those values a second owner and a second set of rules.

#### Scenario: The fields offered

- **WHEN** the form is open
- **THEN** it offers exactly a company field, a position field, a link field and a notes field,
  and the company and position fields are marked as required

#### Scenario: Only the required fields are filled

- **WHEN** a company and a position are given and the link and notes are left empty
- **THEN** the application is stored with no link and no notes

#### Scenario: The same fields when editing

- **WHEN** the form is opened to edit an existing application
- **THEN** it offers exactly the same four fields and no status field

### Requirement: The form refuses an application it cannot store

The form SHALL NOT submit an application that would be rejected. Where a value is missing or
unusable, the form SHALL say which field is at fault and SHALL keep everything the person has
already typed.

This SHALL hold identically whether the form is adding an application or editing one. When an edit
is refused, the stored application SHALL be unchanged, and the form SHALL keep the values the
person typed rather than resetting to the stored ones — the refused values are what they are being
asked to correct.

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

#### Scenario: A required field is cleared when editing

- **WHEN** the form is submitted on an existing application with the company cleared
- **THEN** the stored application is unchanged, the form stays open, and a message identifies the
  company field as the one at fault

#### Scenario: A refused edit is not reset to the stored values

- **WHEN** an edit is refused
- **THEN** the values the person entered are still in the form, not replaced by the stored ones

#### Scenario: Nothing was changed by a refused edit

- **WHEN** an edit has been refused and the board is reloaded
- **THEN** the card shows the values it had before the refused edit

### Requirement: Stored values are bounded in length

Each field SHALL have a maximum length, and a value longer than its maximum SHALL be refused with a
message naming that field. The maximums SHALL be enforced where the application is validated, not
only in the form, because the form is not the only way a value can reach validation.

The same maximums SHALL apply to an edit. Validating in one place is what makes this true without a
second set of limits: an edit reaches the same validation an addition does.

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

#### Scenario: An over-maximum value is refused when editing

- **WHEN** the form is submitted on an existing application with a company longer than its maximum
- **THEN** the stored application is unchanged and a message identifies the company field

### Requirement: A failed write is reported and loses nothing

When storing the application fails for a reason the person cannot see — the database is
unavailable, for instance — the form SHALL stay open with its values intact and SHALL say what did
not happen: that the application was not added, or that it was not updated, matching what was
attempted. The board SHALL go on showing what is stored rather than what was not.

A failure SHALL NOT put the form out of use: submitting again SHALL attempt the write again,
without the page being reloaded.

#### Scenario: The write fails

- **WHEN** the form is submitted and storing the application fails
- **THEN** the form stays open, the values are unchanged, and a message says the application was
  not added

#### Scenario: Nothing is shown that was not stored

- **WHEN** a submission has failed and the board is reloaded
- **THEN** no card for that application is on the board

#### Scenario: An edit fails

- **WHEN** an edit is submitted and storing it fails
- **THEN** the form stays open, the values the person typed are unchanged, and a message says the
  application was not updated

#### Scenario: A failed edit changed nothing

- **WHEN** an edit has failed and the board is reloaded
- **THEN** the card shows the values it had before the failed edit

#### Scenario: The storage fails in a way it cannot describe

- **WHEN** a submission fails for a reason the application cannot classify
- **THEN** the form is still shown with its values and a message says what did not happen, exactly
  as for a failure the storage does describe

#### Scenario: The submission can be retried

- **WHEN** a submission has failed and the person submits the form again
- **THEN** the write is attempted again, without the page being reloaded

### Requirement: The form is operable without a pointer

The form SHALL be reachable, completable and dismissable with the keyboard alone. While it is
open, keyboard focus SHALL stay within it, and on dismissal focus SHALL return to the control that
opened it.

This SHALL hold whichever control opened it: the board's add control, or a card's edit control.

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

#### Scenario: Focus comes back to the card's edit control

- **WHEN** the form was opened from a card's edit control and is dismissed
- **THEN** focus returns to that card's edit control

## ADDED Requirements

### Requirement: The form can be opened on an existing application

The board SHALL offer, for each application, a control that opens the form on that application. The
form SHALL open with the application's stored values already in its fields, so correcting one value
does not mean retyping the rest, and SHALL make clear that it is editing rather than adding.

#### Scenario: Opening the form on an application

- **WHEN** the person activates the edit control on a card
- **THEN** a form is shown over the board with that application's company, position, link and notes
  already filled in

#### Scenario: An application with no link and no notes

- **WHEN** the form is opened on an application that has no link and no notes
- **THEN** the link and notes fields are empty rather than showing a placeholder value as text

#### Scenario: Leaving without saving

- **WHEN** the form is open on an application and the person dismisses it without submitting
- **THEN** the form closes and the stored application is unchanged

#### Scenario: Editing one application after another

- **WHEN** the form has been opened on one application, dismissed, and opened on a different one
- **THEN** it shows the second application's values and none of the first one's

### Requirement: A saved edit updates the application and the board in place

When an edited application is stored, the card SHALL show the new values without the person
reloading the page, and the form SHALL close. The change SHALL be stored, not only shown.

#### Scenario: The edit is saved

- **WHEN** the form is submitted on an existing application with a changed company
- **THEN** the form closes and that card shows the new company

#### Scenario: The edit is stored, not only shown

- **WHEN** an application has been edited and the board is reloaded
- **THEN** the card still shows the edited values

#### Scenario: No second card is created

- **WHEN** an application is edited
- **THEN** the number of cards on the board is unchanged

#### Scenario: Clearing an optional value

- **WHEN** the form is submitted on an application whose link is cleared
- **THEN** the application is stored with no link and its card shows no link control

### Requirement: An edit does not move the card or restart its status clock

Editing an application SHALL change only the four fields the form collects. The application's
status, its application date and the time its status last changed SHALL be left as they are, so a
corrected typo does not move the card to another column, nor make an application look newer to the
"time in this status" count than it is.

#### Scenario: The card stays in its column

- **WHEN** an application in the Interview column is edited
- **THEN** its card is still in the Interview column and the column counts are unchanged

#### Scenario: The status clock is not reset

- **WHEN** an application is edited
- **THEN** the time its status last changed is the same as before the edit

#### Scenario: The application date is kept

- **WHEN** an application that has an application date is edited
- **THEN** its application date is unchanged

#### Scenario: Nothing beyond the four fields is written

- **WHEN** an edit is stored
- **THEN** the values written are exactly the company, the position, the link and the notes, and no
  other field of the application is written at all

### Requirement: Editing an application that no longer exists is reported as such

When the application being edited no longer exists — it was deleted in another tab, or directly in
the database — the form SHALL say that the application was not found rather than reporting an
unexplained failure, and the board SHALL NOT keep showing a card for it.

#### Scenario: The application was deleted while the form was open

- **WHEN** the form is submitted on an application that is found to no longer exist
- **THEN** a message says the application was not found, and no card for it is left on the board
  once the form is closed, without the person having to reload

#### Scenario: A missing application is not reported as a storage failure

- **WHEN** an edit is submitted for an application that no longer exists
- **THEN** the message names the application as not found, and is not the message used when the
  storage fails for a reason it cannot classify
