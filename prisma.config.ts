import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Valor por defecto para que el proyecto arranque aunque falte el archivo .env.
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
