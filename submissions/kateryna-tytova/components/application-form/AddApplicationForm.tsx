"use client";

import { useActionState } from "react";
import type { JobApplication } from "@/app/generated/prisma/client";
import type { ActionResult, ActionState } from "@/lib/applications/action-result";
import { APPLICATION_LIMITS } from "@/lib/applications/validation";

/**
 * The action is a prop rather than an import so the form can be rendered in
 * jsdom: importing the server action would pull Prisma into the test. The
 * dialog supplies `createApplicationFromForm`.
 */
export interface AddApplicationFormProps {
  action: (
    prevState: ActionState<JobApplication>,
    formData: FormData,
  ) => Promise<ActionResult<JobApplication>>;
}

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

export function AddApplicationForm({ action }: AddApplicationFormProps) {
  const [, formAction, pending] = useActionState<ActionState<JobApplication>, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="company" className="text-sm font-medium text-slate-700">
          Company
        </label>
        <input
          id="company"
          name="company"
          type="text"
          required
          maxLength={APPLICATION_LIMITS.company}
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="position" className="text-sm font-medium text-slate-700">
          Position
        </label>
        <input
          id="position"
          name="position"
          type="text"
          required
          maxLength={APPLICATION_LIMITS.position}
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="link" className="text-sm font-medium text-slate-700">
          Link
        </label>
        {/* type="text", not "url": the browser's own URL check would refuse the
            value before the action runs, so the message would not be ours and
            would not name the field the way the rest of the form does. */}
        <input
          id="link"
          name="link"
          type="text"
          maxLength={APPLICATION_LIMITS.link}
          placeholder="https://"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={APPLICATION_LIMITS.notes}
          className={FIELD_CLASS}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add application"}
      </button>
    </form>
  );
}
