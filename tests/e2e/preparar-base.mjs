// Recrea la base de las pruebas de extremo a extremo y carga los datos de prueba.
import { execSync } from "node:child_process";
import { envPruebas } from "../base-pruebas.mjs";

const env = { ...process.env, ...envPruebas };
execSync("npx prisma migrate reset --force", { stdio: "inherit", env });
execSync("npx prisma db seed", { stdio: "inherit", env });
