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

/**
 * What an action says when the storage fails for a reason it cannot classify.
 *
 * Here rather than beside the actions because the move message has two readers:
 * the action that returns it and the hook that falls back to it if the action
 * ever breaks its promise. A `"use server"` file constrains what it exports, not
 * where a string lives - so one constant, imported twice, instead of two copies
 * free to drift.
 *
 * The underlying error is never passed on: a driver's text is not written for
 * the person reading it, and it can carry a file path or a connection string.
 */
export const FAILED = {
  create: "The application was not added. Please try again.",
  move: "The move was not saved. Please try again.",
  update: "The application was not updated. Please try again.",
  remove: "The application was not deleted. Please try again.",
} as const;
