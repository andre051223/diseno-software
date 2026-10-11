import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/** Crea desde cero la base de pruebas aplicando las migraciones. */
export default function prepararBase() {
  for (const archivo of ["prisma/test.db", "prisma/test.db-journal"]) {
    rmSync(archivo, { force: true });
  }
  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
  });
}
