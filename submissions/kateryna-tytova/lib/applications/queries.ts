import { connection } from "next/server";
import type { JobApplication } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read path for the board. Deliberately not a server action: the actions file
 * carries a file-level "use server", which would publish this query as an
 * endpoint for no reason.
 *
 * Unlike the mutating actions, this throws rather than returning ActionResult.
 * A failed read has no partial page to render, so app/error.tsx handles it.
 */
export async function listApplications(): Promise<JobApplication[]> {
  // better-sqlite3 is synchronous, so without this the query completes during
  // prerendering and the board is frozen at build time. The spec requires the
  // data as it is when the page is served.
  await connection();
  return prisma.jobApplication.findMany({ orderBy: { createdAt: "desc" } });
}
