import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { Ref } from "react";
import type { JobApplication } from "@/app/generated/prisma/client";
import { isHttpUrl } from "@/lib/applications/validation";

const CONTROL_CLASS =
  "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:bg-slate-100";

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
  /** True only for the card whose own status write has not settled yet. */
  isMovePending?: boolean;
  /**
   * Opens this application for editing. Absent when the card is rendered
   * outside the board, which is how it stays testable on its own.
   */
  onEdit?: (application: JobApplication) => void;
  /** Asks for this application to be deleted, which the board confirms first. */
  onDelete?: (application: JobApplication) => void;
  /**
   * Supplied by DraggableCard. Absent when the card is rendered outside a
   * DndContext, which keeps this component renderable — and testable — on its own.
   */
  dragHandle?: DragHandleBinding;
}

export function ApplicationCard({
  application,
  isMovePending = false,
  onEdit,
  onDelete,
  dragHandle,
}: ApplicationCardProps) {
  // Re-checked here, not only on write: seed.ts and direct database edits never
  // pass through validateApplicationInput, and a stored javascript: URL would be
  // one click from executing.
  const postingUrl =
    application.link !== null && isHttpUrl(application.link) ? application.link : null;
  const companyId = `card-${application.id}-company`;

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
            disabled={isMovePending}
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
