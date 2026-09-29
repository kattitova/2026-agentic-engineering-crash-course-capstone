import type { ValidationErrors } from "./validation";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: ValidationErrors };

/**
 * What `useActionState` holds between submissions. `null` is the state before
 * anything has been submitted, which is not the same as a failure with no
 * message.
 */
export type ActionState<T> = ActionResult<T> | null;
