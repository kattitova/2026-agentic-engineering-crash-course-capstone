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
  id: string,
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
    // Revalidate on this branch too: the board is optimistically showing a card
    // for a row that no longer exists, and the client's rollback would only put
    // it back in a column it no longer belongs to.
    revalidatePath(BOARD_PATH);
    return NOT_FOUND;
  }
  revalidatePath(BOARD_PATH);
  return { ok: true, data: application };
}

export async function updateApplication(
  id: string,
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
      return NOT_FOUND;
    }
    return failed("update", error);
  }

  revalidatePath(BOARD_PATH);
  return { ok: true, data: application };
}

export async function deleteApplication(id: string): Promise<ActionResult<{ id: string }>> {
  if (!isValidId(id)) {
    return INVALID_ID;
  }

  try {
    await prisma.jobApplication.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NOT_FOUND;
    }
    return failed("remove", error);
  }

  revalidatePath(BOARD_PATH);
  return { ok: true, data: { id } };
}
