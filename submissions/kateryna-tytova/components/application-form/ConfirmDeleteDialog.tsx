"use client";

import { useEffect, useId, useRef } from "react";
import type { JobApplication } from "@/app/generated/prisma/client";

export interface ConfirmDeleteDialogProps {
  /** The application to delete. `null` closes the dialog. */
  application: JobApplication | null;
  /** True while this application's deletion is being stored. */
  pending?: boolean;
  onConfirm: (application: JobApplication) => void;
  /** Declining, dismissing with Escape, or clicking the backdrop. */
  onCancel: () => void;
}

/**
 * Asks before deleting, because nothing here restores a deleted application.
 *
 * A native `<dialog>` rather than `window.confirm`: the focus trap, Escape, the
 * inert background and focus restoration come from the browser, it can name the
 * application in a heading the dialog is labelled by, it cannot be suppressed
 * the way a browser's own confirm can, and it does not block the event loop -
 * which is what lets the confirm control show a pending state while the
 * deletion is stored.
 */
export function ConfirmDeleteDialog({
  application,
  pending = false,
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
              className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Keep it
            </button>
            {/* Held while the write is outstanding, so one confirmation cannot
                become two deletions. */}
            <button
              type="button"
              disabled={pending}
              onClick={() => onConfirm(application)}
              className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete application"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
