"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createApplicationFromForm } from "@/app/actions/applications";
import { AddApplicationForm } from "./AddApplicationForm";

const TITLE_ID = "add-application-title";

export function AddApplicationDialog() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add application
      </button>

      {/* Escape and the backdrop fire `close` without going through our button,
          so the state follows the dialog rather than the other way round. */}
      <dialog
        ref={dialogRef}
        onClose={close}
        aria-labelledby={TITLE_ID}
        className="w-full max-w-md rounded-2xl p-0 backdrop:bg-slate-900/40 open:m-auto"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={TITLE_ID} className="text-lg font-semibold text-slate-900">
              Add application
            </h2>
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          {/* Mounted only while open, so a closed-and-reopened dialog starts
              empty while a refusal leaves everything typed in place. */}
          {open ? (
            <AddApplicationForm action={createApplicationFromForm} onSuccess={close} />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
