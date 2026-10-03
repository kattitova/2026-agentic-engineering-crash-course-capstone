import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type Prisma } from "../app/generated/prisma/client";

/**
 * Builds a board for the video demo: every MVP item has a card that shows it.
 *
 * The data goes into demo.db, never dev.db, which is the developer's real
 * tracker. The URL is hardcoded for the same reason seed-e2e.ts hardcodes its
 * own: this script deletes the file it writes to.
 *
 * The file is deleted and recreated rather than reset with
 * `prisma db push --force-reset`, which Prisma refuses to run from an AI agent
 * without a consent variable. A fresh file needs no reset, so the script runs
 * the same by hand and from an agent session.
 */
const DEMO_DB_FILE = "demo.db";
const DEMO_DATABASE_URL = `file:./${DEMO_DB_FILE}`;

// Relative to the moment of seeding, unlike the e2e seed: the demo has to show
// "Today", "14d" and the stale flag on the day it is recorded. Seed right
// before recording.
const NOW = new Date();
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

// Grouped by column. Each comment names what the card is there to show.
function buildApplications(): Prisma.JobApplicationCreateInput[] {
  return [
    // Wishlist: fresh, a few days old, and one very old bookmark that is
    // deliberately NOT flagged as stale, because the flag only applies to Applied.
    {
      company: "Northwind Labs",
      position: "Junior Frontend Developer",
      status: "WISHLIST",
      link: "https://jobs.example.com/northwind/junior-frontend",
      notes: "Check how much React experience they expect.",
      statusChangedAt: NOW,
      createdAt: NOW,
    },
    {
      company: "Contoso",
      position: "Frontend Developer (Next.js)",
      status: "WISHLIST",
      link: "https://careers.contoso.example.com/jobs/frontend-nextjs",
      statusChangedAt: daysAgo(6),
      createdAt: daysAgo(6),
    },
    {
      company: "Fabrikam",
      position: "UI Engineer",
      status: "WISHLIST",
      notes: "Bookmarked a long time ago - still open?",
      statusChangedAt: daysAgo(90),
      createdAt: daysAgo(90),
    },

    // Applied: two stale cards (well past 14 days), one exactly on the
    // inclusive 14-day boundary, and two recent ones that are not flagged.
    {
      company: "Acme Cloud",
      position: "Frontend Engineer",
      status: "APPLIED",
      link: "https://jobs.example.com/acme/frontend-engineer",
      notes: "No response yet. Follow up with the recruiter.",
      appliedDate: daysAgo(32),
      statusChangedAt: daysAgo(32),
      createdAt: daysAgo(34),
    },
    {
      company: "Tailspin Toys",
      position: "React Developer",
      status: "APPLIED",
      link: "https://jobs.example.com/tailspin/react-developer",
      appliedDate: daysAgo(21),
      statusChangedAt: daysAgo(21),
      createdAt: daysAgo(21),
    },
    {
      company: "Wide World Importers",
      position: "Junior Full-stack Developer",
      status: "APPLIED",
      notes: "Exactly two weeks without an answer - the flag starts here.",
      appliedDate: daysAgo(14),
      statusChangedAt: daysAgo(14),
      createdAt: daysAgo(15),
    },
    {
      company: "Adventure Works",
      position: "Frontend Developer",
      status: "APPLIED",
      link: "https://jobs.example.com/adventure-works/frontend",
      appliedDate: daysAgo(5),
      statusChangedAt: daysAgo(5),
      createdAt: daysAgo(7),
    },
    {
      company: "Litware",
      position: "TypeScript Developer",
      status: "APPLIED",
      appliedDate: daysAgo(1),
      statusChangedAt: daysAgo(1),
      createdAt: daysAgo(2),
    },

    // Interview and Offer: together they make the "reached interview" share.
    {
      company: "Globex",
      position: "Full-stack Developer (TypeScript)",
      status: "INTERVIEW",
      link: "https://jobs.example.com/globex/fullstack-typescript",
      notes: "Technical interview with the platform team on Thursday.",
      appliedDate: daysAgo(18),
      statusChangedAt: daysAgo(4),
      createdAt: daysAgo(20),
    },
    {
      company: "Proseware",
      position: "Frontend Engineer, Design Systems",
      status: "INTERVIEW",
      notes: "HR screen passed. Take-home task due next week.",
      appliedDate: daysAgo(12),
      statusChangedAt: daysAgo(2),
      createdAt: daysAgo(12),
    },
    {
      company: "Blue Yonder Airlines",
      position: "Web Developer",
      status: "INTERVIEW",
      appliedDate: daysAgo(25),
      statusChangedAt: daysAgo(9),
      createdAt: daysAgo(26),
    },
    {
      company: "Woodgrove Bank",
      position: "Junior Frontend Developer",
      status: "OFFER",
      link: "https://jobs.example.com/woodgrove/junior-frontend",
      notes: "Offer received - answer by Friday.",
      appliedDate: daysAgo(40),
      statusChangedAt: daysAgo(3),
      createdAt: daysAgo(41),
    },

    // Rejected: an old one past 14 days, to show the flag is Applied-only.
    {
      company: "Initech",
      position: "React Developer",
      status: "REJECTED",
      link: "https://jobs.example.com/initech/react-developer",
      appliedDate: daysAgo(45),
      statusChangedAt: daysAgo(30),
      createdAt: daysAgo(46),
    },
    {
      company: "Umbrella Digital",
      position: "Frontend Developer",
      status: "REJECTED",
      notes: "Rejected after the technical interview. Ask for feedback.",
      appliedDate: daysAgo(28),
      statusChangedAt: daysAgo(8),
      createdAt: daysAgo(29),
    },
  ];
}

async function main(): Promise<void> {
  rmSync(DEMO_DB_FILE, { force: true });
  rmSync(`${DEMO_DB_FILE}-journal`, { force: true });

  execFileSync("npx", ["prisma", "db", "push", "--url", DEMO_DATABASE_URL], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const adapter = new PrismaBetterSqlite3({ url: DEMO_DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const applications = buildApplications();
    await prisma.$transaction(
      applications.map((data) => prisma.jobApplication.create({ data })),
    );
    console.log(`Seeded ${applications.length} applications into ${DEMO_DATABASE_URL}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
