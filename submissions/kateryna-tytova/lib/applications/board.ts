import type { JobApplication } from "@/app/generated/prisma/client";
import { ApplicationStatus } from "@/app/generated/prisma/enums";
import { isApplicationStatus } from "./status";

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

/**
 * The human-readable name of a status, from the one place that owns the five.
 *
 * A stored status outside the five is possible - SQLite does not enforce the
 * enum - and such a row is left off the board entirely, so this is only ever
 * asked about a status that has a column. The fallback exists because the type
 * cannot say that, not because it is expected.
 */
export function statusLabel(status: ApplicationStatus): string {
  return BOARD_COLUMNS.find((column) => column.status === status)?.label ?? status;
}

export type ApplicationsByStatus = Record<ApplicationStatus, JobApplication[]>;

/**
 * Groups applications by status, with an entry for every status, so callers
 * never branch on a missing key for an empty column.
 *
 * An application whose stored status isn't one of the five is left out: SQLite
 * doesn't enforce the enum, and this runs in a Server Component, so indexing
 * blind would turn one bad row into a blank page.
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
    if (!isApplicationStatus(application.status)) {
      continue;
    }
    grouped[application.status].push(application);
  }

  return grouped;
}
