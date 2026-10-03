"use client";

import { useEffect, useId, useRef } from "react";
import type { JobApplication } from "@/app/generated/prisma/client";
import type { ApplicationStatus } from "@/app/generated/prisma/enums";
import { BOARD_COLUMNS } from "@/lib/applications/board";
import { movableColumns } from "@/lib/applications/move";

export interface MoveCardDialogProps {
  /** The application to move. `null` closes the dialog. */
  application: JobApplication | null;
  onChoose: (application: JobApplication, to: ApplicationStatus) => void;
  /** Dismissing with the button or Escape. Choosing a column does not call this. */
  onCancel: () => void;
}

/**
 * Names the column to move a card to, for a person who cannot drag it.
 *
 * A native `<dialog>` opened with `showModal()`, for the reasons
 * ConfirmDeleteDialog gives: the focus trap, Escape, the inert background and
 * focus restoration come from the browser. A dialog opened with `show()` would
 * pass every test in this file and have none of them, which is why they are
 * pinned in e2e/move-by-menu.spec.ts — jsdom implements neither method.
 *
 * It decides nothing about the move. `onChoose` hands the column back and the
 * board runs it through the same planCardMove and moveCard a drop uses, so a
 * move made here cannot be one that skips the rollback or the failure message.
 */
export function MoveCardDialog({ application, onChoose, onCancel }: MoveCardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = application !== null;
  // Per instance, for the same reason the other dialogs' ids are.
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      aria-labelledby={titleId}
      className="w-full max-w-sm rounded-2xl p-0 backdrop:bg-slate-900/40 open:m-auto"
    >
      {/* Mounted only while open, so the heading never names a card the dialog has
          already been dismissed for. */}
      {application === null ? null : (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {`Move ${application.company} to…`}
            </h2>
            {/* Text, not a disabled button: the current column is information, and a
                disabled control in a list of choices reads as one that is broken. */}
            <p className="text-sm leading-5 text-slate-600">
              {`Currently in ${currentLabel(application.status)}.`}
            </p>
          </div>

          {/* h-11: a touch target, which is the reason this dialog exists. The
              drag handle it replaces is 26px. */}
          <div className="flex flex-col gap-2">
            {movableColumns(application.status).map((column) => (
              <button
                key={column.status}
                type="button"
                onClick={() => onChoose(application, column.status)}
                className="inline-flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <span className={`size-2.5 rounded-full ${column.dotClass}`} aria-hidden="true" />
                {column.label}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** A stored status outside the five has no column; the raw value is the fallback. */
function currentLabel(status: JobApplication["status"]): string {
  return BOARD_COLUMNS.find((column) => column.status === status)?.label ?? status;
}
