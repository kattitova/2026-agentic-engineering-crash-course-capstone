"use client";

import { useEffect, useId, useRef } from "react";
import type { JobApplication } from "@/app/generated/prisma/client";

export interface ConfirmDeleteDialogProps {
  /** The application to delete. `null` closes the dialog. */
  application: JobApplication | null;
  onConfirm: (application: JobApplication) => void;
  /** Declining, dismissing with Escape, or clicking the backdrop. */
  onCancel: () => void;
}

/**
 * Asks before deleting, because nothing here restores a deleted application.
 *
 * A native `<dialog>` rather than `window.confirm`: the focus trap, Escape, the
 * inert background and focus restoration come from the browser, it can name the
 * application in a heading the dialog is labelled by, and it cannot be
 * suppressed the way a browser's own confirm can.
 *
 * It carries no pending state. The board closes it before the write starts, so
 * a second confirmation is impossible because the control no longer exists - a
 * disabled-while-writing prop would be a state the app cannot produce, and two
 * tests asserting one.
 */
export function ConfirmDeleteDialog({
  application,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = application !== null;
  // Per instance, for the same reason ApplicationDialog's is: a module constant
  // is a duplicate id as soon as the page holds a second dialog.
  const titleId = useId();
  const bodyId = useId();

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
      aria-describedby={bodyId}
      className="w-full max-w-sm rounded-2xl p-0 backdrop:bg-slate-900/40 open:m-auto"
    >
      {/* Mounted only while open, so the name in the heading is never the name of
          an application the dialog has already been dismissed for. */}
      {application === null ? null : (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {`Delete ${application.company}?`}
          </h2>
          <p id={bodyId} className="text-sm leading-5 text-slate-600">
            {`${application.position} at ${application.company} will be removed from the board. This cannot be undone.`}
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => onConfirm(application)}
              className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              Delete application
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
