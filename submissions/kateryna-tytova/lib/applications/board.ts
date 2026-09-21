import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";

export interface BoardColumn {
  status: ApplicationStatus;
  label: string;
  /** Tailwind background class for the column's status dot. */
  dotClass: string;
}

// Exhaustive over ApplicationStatus: a new status fails to compile here first.
const COLUMN_DEFINITIONS: Record<ApplicationStatus, Omit<BoardColumn, "status">> = {
  WISHLIST: { label: "Wishlist", dotClass: "bg-slate-400" },
  APPLIED: { label: "Applied", dotClass: "bg-sky-500" },
  INTERVIEW: { label: "Interview", dotClass: "bg-violet-500" },
  OFFER: { label: "Offer", dotClass: "bg-emerald-500" },
  REJECTED: { label: "Rejected", dotClass: "bg-rose-400" },
};

// Funnel order, deliberately independent of the enum's declaration order.
const COLUMN_ORDER: readonly ApplicationStatus[] = [
  ApplicationStatus.WISHLIST,
  ApplicationStatus.APPLIED,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
];

export const BOARD_COLUMNS: readonly BoardColumn[] = COLUMN_ORDER.map((status) => ({
  status,
  ...COLUMN_DEFINITIONS[status],
}));

export type ApplicationsByStatus = Record<ApplicationStatus, JobApplication[]>;

/**
 * Groups applications by status, with an entry for every status, so callers
 * never branch on a missing key for an empty column.
 */
export function groupApplicationsByStatus(
  applications: readonly JobApplication[],
): ApplicationsByStatus {
  const grouped: ApplicationsByStatus = {
    WISHLIST: [],
    APPLIED: [],
    INTERVIEW: [],
    OFFER: [],
    REJECTED: [],
  };

  for (const application of applications) {
    grouped[application.status].push(application);
  }

  return grouped;
}
