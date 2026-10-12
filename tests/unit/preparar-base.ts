import { execSync } from "node:child_process";
import { envPruebas } from "../base-pruebas.mjs";

/** Crea desde cero la base de pruebas aplicando las migraciones. */
export default function prepararBase() {
  execSync("npx prisma migrate reset --force", {
    stdio: "ignore",
    env: { ...process.env, ...envPruebas },
  });
}
