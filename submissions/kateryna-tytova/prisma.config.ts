import "dotenv/config";
import { defineConfig } from "prisma/config";

// Fallback keeps `npm install && npx prisma db push && npm run dev` working
// from a fresh clone, where the gitignored .env doesn't exist yet.
const databaseUrl = process.env["DATABASE_URL"] ?? "file:./dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
