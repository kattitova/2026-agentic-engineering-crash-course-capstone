"use client";

import { useEffect, useRef } from "react";
import {
  createApplicationFromForm,
  updateApplicationFromForm,
} from "@/app/actions/applications";
import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationForm, type Values } from "./ApplicationForm";

const TITLE_ID = "application-dialog-title";

export interface ApplicationDialogProps {
  open: boolean;
  /**
   * The application to edit. Absent means the dialog is adding one.
   *
   * Controlled from outside rather than owning its own open state: the board
   * renders one dialog for every card, so which application it is on is the
   * board's to decide.
   */
  application?: JobApplication | null;
  onClose: () => void;
}

/** A stored null is an empty field, not the text "null". */
function valuesOf(application: JobApplication): Values {
  return {
    company: application.company,
    position: application.position,
    link: application.link ?? "",
    notes: application.notes ?? "",
  };
}

export function ApplicationDialog({ open, application, onClose }: ApplicationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editing = application ?? null;

  // showModal() rather than show(): the focus trap, Escape, the inert
  // background and the backdrop are all the browser's, so none of them is
  // written here and none of them can be got subtly wrong.
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
    // Escape and the backdrop fire `close` without going through our button,
    // so the state follows the dialog rather than the other way round.
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={TITLE_ID}
      className="w-full max-w-md rounded-2xl p-0 backdrop:bg-slate-900/40 open:m-auto"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={TITLE_ID} className="text-lg font-semibold text-slate-900">
            {editing === null ? "Add application" : "Edit application"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>

        {/* Mounted only while open, and keyed by the application, so the form
            seeds its state afresh: a closed-and-reopened dialog starts clean,
            opening it on a second application shows none of the first one's
            values, and a refusal leaves everything typed in place. */}
        {open ? (
          editing === null ? (
            <ApplicationForm action={createApplicationFromForm} onSuccess={onClose} />
          ) : (
            <ApplicationForm
              key={editing.id}
              action={updateApplicationFromForm}
              id={editing.id}
              initialValues={valuesOf(editing)}
              submitLabel="Save changes"
              pendingLabel="Saving…"
              onSuccess={onClose}
            />
          )
        ) : null}
      </div>
    </dialog>
  );
}
