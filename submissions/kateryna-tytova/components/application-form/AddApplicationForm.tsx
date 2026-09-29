"use client";

import { useActionState } from "react";
import type { JobApplication } from "@/app/generated/prisma/client";
import type { ActionResult, ActionState } from "@/lib/applications/action-result";
import { APPLICATION_LIMITS, type ValidationErrors } from "@/lib/applications/validation";

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
  "w-full rounded-lg border px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:ring-2 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-200 border-slate-300 focus:border-indigo-500 focus:ring-indigo-200";

interface FieldProps {
  name: keyof ValidationErrors;
  label: string;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  error?: string;
}

function Field({ name, label, required, multiline, placeholder, error }: FieldProps) {
  const errorId = `${name}-error`;
  // Tied to the field rather than merely placed next to it, so assistive
  // technology reads the message as part of the field and not as loose text.
  const shared = {
    id: name,
    name,
    required,
    maxLength: APPLICATION_LIMITS[name],
    placeholder,
    className: FIELD_CLASS,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? errorId : undefined,
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} type="text" />}
      {error ? (
        <p id={errorId} className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AddApplicationForm({ action }: AddApplicationFormProps) {
  const [state, formAction, pending] = useActionState<ActionState<JobApplication>, FormData>(
    action,
    null,
  );

  const fieldErrors: ValidationErrors = (state && !state.ok && state.fieldErrors) || {};
  // Only when nothing points at a field: otherwise "Invalid application data"
  // would be announced on top of the messages that actually say what is wrong.
  const formError =
    state && !state.ok && Object.keys(fieldErrors).length === 0 ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}

      <Field name="company" label="Company" required error={fieldErrors.company} />
      <Field name="position" label="Position" required error={fieldErrors.position} />
      {/* type="text", not "url": the browser's own URL check would refuse the
          value before the action runs, so the message would not be ours and
          would not name the field the way the rest of the form does. */}
      <Field name="link" label="Link" placeholder="https://" error={fieldErrors.link} />
      <Field name="notes" label="Notes" multiline error={fieldErrors.notes} />

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
