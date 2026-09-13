import "dotenv/config";
import type { Prisma } from "../app/generated/prisma/client";
import { prisma } from "../lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

// One application per interesting board state: fresh wishlist item, a stale
// APPLIED one (> 14 days), an active interview and a rejection.
function buildSeedApplications(now: Date): Prisma.JobApplicationCreateInput[] {
  return [
    {
      company: "Northwind Labs",
      position: "Junior Frontend Developer",
      status: "WISHLIST",
      link: "https://jobs.example.com/northwind/junior-frontend",
      notes: "Check how much React experience they expect.",
      statusChangedAt: daysAgo(now, 3),
      createdAt: daysAgo(now, 3),
    },
    {
      company: "Acme Cloud",
      position: "Frontend Engineer",
      status: "APPLIED",
      link: "https://jobs.example.com/acme/frontend-engineer",
      notes: "No response yet.",
      appliedDate: daysAgo(now, 20),
      statusChangedAt: daysAgo(now, 20),
      createdAt: daysAgo(now, 22),
    },
    {
      company: "Globex",
      position: "Full-stack Developer (TypeScript)",
      status: "INTERVIEW",
      notes: "Technical interview scheduled with the platform team.",
      appliedDate: daysAgo(now, 12),
      statusChangedAt: daysAgo(now, 4),
      createdAt: daysAgo(now, 14),
    },
    {
      company: "Initech",
      position: "React Developer",
      status: "REJECTED",
      link: "https://jobs.example.com/initech/react-developer",
      appliedDate: daysAgo(now, 30),
      statusChangedAt: daysAgo(now, 9),
      createdAt: daysAgo(now, 31),
    },
  ];
}

async function main(): Promise<void> {
  // dev.db is the real personal tracker, so never wipe existing applications.
  const existing = await prisma.jobApplication.count();
  if (existing > 0) {
    console.log(`Skipping seed: database already has ${existing} application(s).`);
    return;
  }

  const applications = buildSeedApplications(new Date());
  await prisma.$transaction(
    applications.map((data) => prisma.jobApplication.create({ data })),
  );
  console.log(`Seeded ${applications.length} job applications.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
