// Recrea la base de las pruebas de extremo a extremo y carga los datos de prueba.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const env = { ...process.env, DATABASE_URL: "file:./prisma/e2e.db" };
for (const archivo of ["prisma/e2e.db", "prisma/e2e.db-journal"]) rmSync(archivo, { force: true });
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx prisma db seed", { stdio: "inherit", env });
