"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  /** Called once per successful submission, so the dialog can close itself. */
  onSuccess?: (application: JobApplication) => void;
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
  value: string;
  onChange: (value: string) => void;
}

function Field({
  name,
  label,
  required,
  multiline,
  placeholder,
  error,
  value,
  onChange,
}: FieldProps) {
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
    // Controlled, because React resets an uncontrolled form as soon as its
    // action resolves - which on a refusal would throw away the submission the
    // person is being asked to correct.
    value,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
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

type Values = Record<keyof ValidationErrors, string>;

const EMPTY: Values = { company: "", position: "", link: "", notes: "" };

export function AddApplicationForm({ action, onSuccess }: AddApplicationFormProps) {
  const [values, setValues] = useState<Values>(EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  const set = (name: keyof Values) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const [state, formAction, pending] = useActionState<ActionState<JobApplication>, FormData>(
    action,
    null,
  );

  // `state` is a fresh object per submission, so this fires once per result and
  // not again on an unrelated re-render.
  useEffect(() => {
    if (!state) {
      return;
    }
    if (state.ok) {
      onSuccess?.(state.data);
      return;
    }
    // Moving focus is what makes the message reach someone who is not looking
    // at the screen: the field is announced with its description, which
    // aria-describedby alone would not be until they happened to tab back to
    // it. The first in document order, which is the first one they would reach
    // on their own.
    const firstAtFault = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstAtFault?.focus();
  }, [state, onSuccess]);

  const fieldErrors: ValidationErrors = (state && !state.ok && state.fieldErrors) || {};
  // Only when nothing points at a field: otherwise "Invalid application data"
  // would be announced on top of the messages that actually say what is wrong.
  const formError =
    state && !state.ok && Object.keys(fieldErrors).length === 0 ? state.error : null;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}

      <Field
        name="company"
        label="Company"
        required
        error={fieldErrors.company}
        value={values.company}
        onChange={set("company")}
      />
      <Field
        name="position"
        label="Position"
        required
        error={fieldErrors.position}
        value={values.position}
        onChange={set("position")}
      />
      {/* type="text", not "url": the browser's own URL check would refuse the
          value before the action runs, so the message would not be ours and
          would not name the field the way the rest of the form does. */}
      <Field
        name="link"
        label="Link"
        placeholder="https://"
        error={fieldErrors.link}
        value={values.link}
        onChange={set("link")}
      />
      <Field
        name="notes"
        label="Notes"
        multiline
        error={fieldErrors.notes}
        value={values.notes}
        onChange={set("notes")}
      />

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
