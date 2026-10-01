"use client";

import { useCallback, useState } from "react";
import { ApplicationDialog } from "./ApplicationDialog";

/**
 * The header's add control and the dialog it opens.
 *
 * Separate from ApplicationDialog because the dialog is controlled: the board
 * renders one for editing and decides which application it is on. Only the add
 * case has a trigger that owns its own open state, and that is this.
 */
export function AddApplicationButton() {
  const [open, setOpen] = useState(false);
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

      <ApplicationDialog open={open} onClose={close} />
    </>
  );
}
