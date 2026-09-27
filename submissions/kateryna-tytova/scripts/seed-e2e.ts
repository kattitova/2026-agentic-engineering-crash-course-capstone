import { execFileSync } from "node:child_process";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type Prisma } from "../app/generated/prisma/client";

/**
 * Builds the disposable database the e2e suite runs against.
 *
 * The URL is hardcoded rather than read from the environment: this script
 * resets the schema, and pointing it at dev.db by accident would delete the
 * developer's real tracker.
 */
const E2E_DATABASE_URL = "file:./e2e.db";

// A fixed instant, not new Date(): running the script twice must leave byte-identical
// rows, so a failing e2e assertion is never explained by "the data aged".
const SEEDED_AT = new Date("2026-01-15T09:00:00.000Z");

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (days: number) => new Date(SEEDED_AT.getTime() - days * DAY_MS);

function buildApplications(): Prisma.JobApplicationCreateInput[] {
  return [
    {
      id: "e2e-wishlist",
      company: "Northwind Labs",
      position: "Junior Frontend Developer",
      status: "WISHLIST",
      link: "https://jobs.example.com/northwind/junior-frontend",
      statusChangedAt: daysBefore(3),
      createdAt: daysBefore(3),
    },
    {
      id: "e2e-applied",
      company: "Acme Cloud",
      position: "Frontend Engineer",
      status: "APPLIED",
      link: "https://jobs.example.com/acme/frontend-engineer",
      appliedDate: daysBefore(20),
      statusChangedAt: daysBefore(20),
      createdAt: daysBefore(22),
    },
    {
      id: "e2e-interview",
      company: "Globex",
      position: "Full-stack Developer (TypeScript)",
      status: "INTERVIEW",
      appliedDate: daysBefore(12),
      statusChangedAt: daysBefore(4),
      createdAt: daysBefore(14),
    },
  ];
}

async function main(): Promise<void> {
  // --url rather than DATABASE_URL: the target is named on the command line, so
  // no ambient environment can redirect a schema reset at dev.db.
  // --force-reset drops the schema first, which is what makes a second run leave
  // the same data instead of failing on duplicate ids.
  execFileSync(
    "npx",
    ["prisma", "db", "push", "--url", E2E_DATABASE_URL, "--force-reset"],
    { stdio: "inherit", shell: process.platform === "win32" },
  );

  const adapter = new PrismaBetterSqlite3({ url: E2E_DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const applications = buildApplications();
    await prisma.$transaction(
      applications.map((data) => prisma.jobApplication.create({ data })),
    );
    console.log(`Seeded ${applications.length} applications into ${E2E_DATABASE_URL}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
