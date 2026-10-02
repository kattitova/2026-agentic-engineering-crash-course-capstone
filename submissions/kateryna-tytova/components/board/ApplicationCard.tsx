import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { Ref } from "react";
import type { JobApplication } from "@/app/generated/prisma/client";
import { BOARD_COLUMNS } from "@/lib/applications/board";
import {
  daysInStatus,
  describeDaysInStatus,
  hasNoMovement,
  STALE_AFTER_DAYS,
} from "@/lib/applications/status-age";
import { isAcceptableLink } from "@/lib/applications/validation";

// An outline, not a background tint alone: these controls are icon-only, and a
// tint is the one focus indicator that disappears against a card that is itself
// light - and that carries no contrast at all in forced-colors mode.
const CONTROL_CLASS =
  "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600";

/** The outline icons the three controls share. */
const ICON = {
  viewBox: "0 0 24 24",
  width: 14,
  height: 14,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export interface DragHandleBinding {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  /** Lets the board put focus back on this handle after a keyboard move. */
  ref?: Ref<HTMLButtonElement>;
}

interface ApplicationCardProps {
  application: JobApplication;
  /**
   * True while this card has a write in flight, of either kind. It disables the
   * drag handle: a card whose status or deletion has not settled must not start
   * another move. The edit and delete controls stay usable - the person can
   * still correct a typo while a status write is outstanding.
   */
  isCardBusy?: boolean;
  /**
   * Opens this application for editing. Absent when the card is rendered
   * outside the board, which is how it stays testable on its own.
   */
  onEdit?: (application: JobApplication) => void;
  /** Asks for this application to be deleted, which the board confirms first. */
  onDelete?: (application: JobApplication) => void;
  /**
   * The instant the board was served, which the day count is measured against.
   *
   * Required, with no default. This component is in the client bundle, so it
   * renders on the server for the HTML and again on hydration; a default that
   * reached for a clock would give two different numbers and mismatch, while
   * type-checking and keeping every test green.
   */
  now: Date;
  /**
   * Supplied by DraggableCard. Absent when the card is rendered outside a
   * DndContext, which keeps this component renderable — and testable — on its own.
   */
  dragHandle?: DragHandleBinding;
}

/**
 * The human-readable name of a status, from the one place that owns the five.
 *
 * A stored status outside the five is possible — SQLite does not enforce the
 * enum — and such a row is left off the board entirely, so this is only ever
 * asked about a status that has a column. The fallback exists because the type
 * cannot say that, not because it is expected.
 */
function statusLabel(status: JobApplication["status"]): string {
  return BOARD_COLUMNS.find((column) => column.status === status)?.label ?? status;
}

export function ApplicationCard({
  application,
  isCardBusy = false,
  onEdit,
  onDelete,
  now,
  dragHandle,
}: ApplicationCardProps) {
  // Re-checked here, not only on write: seed.ts and direct database edits never
  // pass through validateApplicationInput, and a stored javascript: URL would be
  // one click from executing.
  const postingUrl =
    application.link !== null && isAcceptableLink(application.link) ? application.link : null;
  const companyId = `card-${application.id}-company`;
  const age = describeDaysInStatus(
    daysInStatus(application.statusChangedAt, now),
    statusLabel(application.status),
  );
  const noMovement = hasNoMovement(application, now);

  return (
    // Named, so card-by-card navigation says which application it lands on
    // instead of announcing an unnamed "article".
    <article
      aria-labelledby={companyId}
      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        {/* break-words so a long unbroken token can't widen the column; the clamp
            keeps one card from towering over the rest, and — because it implies
            overflow:hidden — also lets this flex item shrink below its content
            width. Drop the clamp and a 200-character company name overflows the
            row again: the h3 keeps its min-content width of ~2053px inside a
            268px column. Held by e2e/long-value-layout.spec.ts, which measures
            it in both viewports rather than leaving it to a note here. */}
        <h3
          id={companyId}
          className="line-clamp-3 break-words text-sm font-semibold leading-5 text-slate-900"
        >
          {application.company}
        </h3>

        {/* One shrink-0 group, so the heading stays the only flexible item in the
            row and keeps the clamp the layout test measures. */}
        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
          {onEdit === undefined ? null : (
            <button
              type="button"
              // Named after the application: three cards side by side otherwise
              // offer three controls all called "Edit".
              aria-label={`Edit ${application.company}`}
              onClick={() => onEdit(application)}
              className={CONTROL_CLASS}
            >
              <svg {...ICON} aria-hidden="true">
                <path d="M4 20h4l10-10-4-4L4 16v4ZM14.5 5.5l4 4" />
              </svg>
            </button>
          )}

          {onDelete === undefined ? null : (
            <button
              type="button"
              aria-label={`Delete ${application.company}`}
              onClick={() => onDelete(application)}
              className={`${CONTROL_CLASS} hover:text-rose-600`}
            >
              <svg {...ICON} aria-hidden="true">
                <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M11 11v5M14 11v5" />
              </svg>
            </button>
          )}

          {/* A real button, not a draggable card: the card holds a link, and making
              the whole card the drag source turns every link click into a possible
              drag. A button is also focusable and announced as a control for free.
              Last in the row, so the two controls above are not in the path of a
              pointer reaching for the handle. */}
          <button
            ref={dragHandle?.ref}
            type="button"
            disabled={isCardBusy}
            aria-label={`Move ${application.company}`}
            className={`${CONTROL_CLASS} cursor-grab disabled:cursor-wait disabled:opacity-40`}
            {...dragHandle?.attributes}
            {...dragHandle?.listeners}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="6" r="1.6" />
              <circle cx="15" cy="6" r="1.6" />
              <circle cx="9" cy="12" r="1.6" />
              <circle cx="15" cy="12" r="1.6" />
              <circle cx="9" cy="18" r="1.6" />
              <circle cx="15" cy="18" r="1.6" />
            </svg>
          </button>
        </div>
      </div>

      <p className="line-clamp-2 break-words text-sm leading-5 text-slate-600">
        {application.position}
      </p>

      {/* Its own row, not the header: that row is already three controls beside a
          heading that is the only flexible item in it, and the heading's clamp is
          what the layout test measures. shrink-0 and tabular-nums so a four-digit
          count cannot reflow the row it sits in.

          flex-wrap because the row holds two non-shrinking pills once a card is
          flagged. Without it they overflow instead of dropping to a second line -
          the same mechanism that overflowed the heading before its clamp. The
          card grows taller, which the column absorbs; what must not change is
          any column's width. */}
      <p className="mt-2 flex flex-wrap gap-1.5">
        {/* slate-600, not the slate-500 BoardColumn's count uses. That badge sits
            on bg-white and clears AA at 4.76:1; the same colour on this bg-slate-100
            is 4.34:1, under the 4.5:1 minimum for 12px text. slate-600 is 6.92:1,
            which leaves room for Tailwind 4's oklch values not being exactly the
            sRGB hexes those numbers were computed from. */}
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
          {/* Real text in an .sr-only span rather than an aria-label: a bare
              <span> carries ARIA's name-prohibited `generic` role, so a label on
              it is not something a screen reader can be relied on to announce.
              The same split BoardColumn's count already makes. */}
          <span aria-hidden="true">{age.short}</span>
          <span className="sr-only">{age.full}</span>
        </span>

        {/* Visible text, not colour alone: colour as the only carrier of meaning
            fails WCAG 1.4.1, so a reader who cannot tell amber from slate would
            have nothing to go on. The tint reinforces the word; it does not
            replace it.

            amber-800 on amber-100 is 6.37:1, computed against the tint the text
            actually sits on, as the 2026-10-02 spec.md entry asks. amber-700 was
            the first choice and is 4.51:1 - it clears the 4.5:1 minimum for 12px
            text by 0.01, which is no margin at all for Tailwind 4's oklch values
            not being the sRGB hexes these numbers come from. amber-600, the
            obvious warning colour, is 2.86:1 and fails outright. */}
        {noMovement ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            <span aria-hidden="true">No movement</span>
            {/* Does not end in " in <Status>": e2e/days-in-status.spec.ts counts
                day badges by that shape, and a sentence ending that way would be
                counted as a second one. Ends on the threshold instead, which also
                says the rule out loud. */}
            <span className="sr-only">{`No movement for ${STALE_AFTER_DAYS} days or more`}</span>
          </span>
        ) : null}
      </p>
      {postingUrl !== null ? (
        <a
          href={postingUrl}
          target="_blank"
          rel="noopener noreferrer"
          // Names the application (a link list is otherwise "View posting" over
          // and over) and says the tab is new, which target="_blank" does not.
          aria-label={`View posting at ${application.company} (opens in a new tab)`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          View posting
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>
      ) : null}
    </article>
  );
}
