import type { ValidationErrors } from "./validation";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: ValidationErrors };
