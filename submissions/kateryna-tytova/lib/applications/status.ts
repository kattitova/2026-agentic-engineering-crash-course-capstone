import { ApplicationStatus } from "@/app/generated/prisma/enums";

const STATUSES: readonly string[] = Object.values(ApplicationStatus);

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && STATUSES.includes(value);
}

export interface StatusState {
  status: ApplicationStatus;
  appliedDate: Date | null;
}

export interface StatusChange {
  status: ApplicationStatus;
  statusChangedAt: Date;
  appliedDate?: Date;
}

/**
 * Decides which fields to write when an application moves to `next`.
 * Returns null when nothing changes (e.g. a card dropped back into its own column),
 * so `statusChangedAt` isn't reset by a no-op move.
 */
export function planStatusChange(
  current: StatusState,
  next: ApplicationStatus,
  now: Date,
): StatusChange | null {
  if (current.status === next) {
    return null;
  }

  const change: StatusChange = { status: next, statusChangedAt: now };
  if (next === ApplicationStatus.APPLIED && current.appliedDate === null) {
    change.appliedDate = now;
  }
  return change;
}
