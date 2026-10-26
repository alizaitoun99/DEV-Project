import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  // Generation and schema validation work without database credentials.
  // Commands that connect to a database require DIRECT_URL.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
