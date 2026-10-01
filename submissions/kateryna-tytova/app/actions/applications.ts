"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { Prisma, type JobApplication } from "@/app/generated/prisma/client";
import { FAILED, type ActionResult, type ActionState } from "@/lib/applications/action-result";
import { isApplicationStatus, planStatusChange } from "@/lib/applications/status";
import {
  validateApplicationInput,
  type RawApplicationInput,
} from "@/lib/applications/validation";
import { prisma } from "@/lib/prisma";

const BOARD_PATH = "/";

const NOT_FOUND = { ok: false, error: "Application not found" } as const;

/**
 * The row is gone, so the board is showing a card for something that no longer
 * exists. Revalidating is what takes that card off without a reload - the same
 * reason updateApplicationStatus revalidates on its own not-found branch.
 *
 * Only on this branch, never on a failure the action could not classify: there
 * the write provably did not happen, and refetching the board would say
 * otherwise.
 */
function notFound() {
  revalidatePath(BOARD_PATH);
  return NOT_FOUND;
}
const INVALID_ID = { ok: false, error: "Invalid application id" } as const;

/**
 * Turns an unclassified failure into a result, so ActionResult means what its
 * type says: an action settles, it never rejects. A rejection is not a failure
 * a caller can report - React rethrows it during render and app/error.tsx
 * replaces the page, which is how a failed write came to be announced as a
 * failed read.
 *
 * Each `try` encloses the storage call and nothing else. revalidatePath stays
 * outside it: a cache call that failed after the row was written is a bug, and
 * reporting it as "the application was not added" would say the opposite of
 * what happened.
 */
function failed(where: keyof typeof FAILED, error: unknown) {
  // First, because Next signals redirect(), notFound(), forbidden() and
  // unauthorized() by throwing. Swallowed, the redirect simply never happens
  // and this returns a failure for a write that succeeded.
  unstable_rethrow(error);
  // Swallowing this would trade a visible crash for an invisible one.
  console.error(error);
  return { ok: false, error: FAILED[where] } as const;
}

// Server actions are public endpoints: TypeScript types don't guard runtime input.
// Hence `id: unknown` on each action below rather than `id: string` - the id can
// arrive from a hidden form field, and a signature that claimed otherwise would
// need a cast at the call site to say so.
function isValidId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0;
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function createApplication(
  input: RawApplicationInput,
): Promise<ActionResult<JobApplication>> {
  const validation = validateApplicationInput(input);
  if (!validation.ok) {
    return { ok: false, error: "Invalid application data", fieldErrors: validation.errors };
  }

  let application;
  try {
    application = await prisma.jobApplication.create({ data: validation.data });
  } catch (error) {
    return failed("create", error);
  }

  revalidatePath(BOARD_PATH);
  return { ok: true, data: application };
}

/**
 * The `useActionState` shape over `createApplication`.
 *
 * `FormData.get` returns `string | File | null` and the values go through
 * untouched: `validateApplicationInput` already rejects a non-string, so
 * coercing here would add a second place that decides what counts as empty.
 *
 * A write that fails comes back as `{ ok: false, error }` with no field, which
 * is the shape the form renders in its one alert region. The wrapper needs no
 * `try` of its own: `createApplication` does not reject.
 */
export async function createApplicationFromForm(
  _prevState: ActionState<JobApplication>,
  formData: FormData,
): Promise<ActionResult<JobApplication>> {
  return createApplication({
    company: formData.get("company"),
    position: formData.get("position"),
    link: formData.get("link"),
    notes: formData.get("notes"),
  });
}

export async function updateApplicationStatus(
  id: unknown,
  status: unknown,
): Promise<ActionResult<JobApplication>> {
  if (!isValidId(id)) {
    return INVALID_ID;
  }
  if (!isApplicationStatus(status)) {
    return { ok: false, error: "Unknown status" };
  }

  let application;
  try {
    // Read and write in one transaction so appliedDate is decided on fresh data.
    application = await prisma.$transaction(async (tx) => {
      const current = await tx.jobApplication.findUnique({ where: { id } });
      if (!current) {
        return null;
      }
      const change = planStatusChange(current, status, new Date());
      return change ? tx.jobApplication.update({ where: { id }, data: change }) : current;
    });
  } catch (error) {
    return failed("move", error);
  }

  if (!application) {
    // The client's rollback would only put the card back in a column it no
    // longer belongs to, so the board has to be refetched rather than restored.
    return notFound();
  }
  revalidatePath(BOARD_PATH);
  return { ok: true, data: application };
}

export async function updateApplication(
  id: unknown,
  input: RawApplicationInput,
): Promise<ActionResult<JobApplication>> {
  if (!isValidId(id)) {
    return INVALID_ID;
  }
  const validation = validateApplicationInput(input);
  if (!validation.ok) {
    return { ok: false, error: "Invalid application data", fieldErrors: validation.errors };
  }

  let application;
  try {
    application = await prisma.jobApplication.update({ where: { id }, data: validation.data });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return notFound();
    }
    return failed("update", error);
  }

  revalidatePath(BOARD_PATH);
  return { ok: true, data: application };
}

/**
 * The `useActionState` shape over `updateApplication`.
 *
 * The id comes from a hidden field, so it is as untrusted as the rest of the
 * form and goes through untouched: `updateApplication` already refuses anything
 * that is not a non-empty string, and `FormData.get` returns `string | File |
 * null` - exactly the shapes that check is for.
 */
export async function updateApplicationFromForm(
  _prevState: ActionState<JobApplication>,
  formData: FormData,
): Promise<ActionResult<JobApplication>> {
  return updateApplication(formData.get("id"), {
    company: formData.get("company"),
    position: formData.get("position"),
    link: formData.get("link"),
    notes: formData.get("notes"),
  });
}

export async function deleteApplication(id: unknown): Promise<ActionResult<{ id: string }>> {
  if (!isValidId(id)) {
    return INVALID_ID;
  }

  try {
    await prisma.jobApplication.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return notFound();
    }
    return failed("remove", error);
  }

  revalidatePath(BOARD_PATH);
  return { ok: true, data: { id } };
}
