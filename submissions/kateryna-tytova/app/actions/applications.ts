"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type JobApplication } from "@/app/generated/prisma/client";
import type { ActionResult } from "@/lib/applications/action-result";
import { isApplicationStatus, planStatusChange } from "@/lib/applications/status";
import {
  validateApplicationInput,
  type RawApplicationInput,
} from "@/lib/applications/validation";
import { prisma } from "@/lib/prisma";

const BOARD_PATH = "/";

const NOT_FOUND = { ok: false, error: "Application not found" } as const;
const INVALID_ID = { ok: false, error: "Invalid application id" } as const;

// Server actions are public endpoints: TypeScript types don't guard runtime input.
function isValidId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0;
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function listApplications(): Promise<JobApplication[]> {
  return prisma.jobApplication.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createApplication(
  input: RawApplicationInput,
): Promise<ActionResult<JobApplication>> {
  const validation = validateApplicationInput(input);
  if (!validation.ok) {
    return { ok: false, error: "Invalid application data", fieldErrors: validation.errors };
  }

  const application = await prisma.jobApplication.create({ data: validation.data });
  revalidatePath(BOARD_PATH);
  return { ok: true, data: application };
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

  // Read and write in one transaction so appliedDate is decided on fresh data.
  const application = await prisma.$transaction(async (tx) => {
    const current = await tx.jobApplication.findUnique({ where: { id } });
    if (!current) {
      return null;
    }
    const change = planStatusChange(current, status, new Date());
    return change ? tx.jobApplication.update({ where: { id }, data: change }) : current;
  });

  if (!application) {
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

  try {
    const application = await prisma.jobApplication.update({
      where: { id },
      data: validation.data,
    });
    revalidatePath(BOARD_PATH);
    return { ok: true, data: application };
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NOT_FOUND;
    }
    throw error;
  }
}

export async function deleteApplication(id: string): Promise<ActionResult<{ id: string }>> {
  if (!isValidId(id)) {
    return INVALID_ID;
  }

  try {
    await prisma.jobApplication.delete({ where: { id } });
    revalidatePath(BOARD_PATH);
    return { ok: true, data: { id } };
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NOT_FOUND;
    }
    throw error;
  }
}
