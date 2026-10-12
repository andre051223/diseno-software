import { defineConfig, devices } from "@playwright/test";
import { envPruebas } from "./tests/base-pruebas.mjs";

const PUERTO = 3200;
const URL_BASE = `http://localhost:${PUERTO}`;

/**
 * Pruebas de extremo a extremo. Usan la base de pruebas (DATABASE_URL_PRUEBAS), que se
 * recrea y se llena con la semilla antes de levantar el servidor de producción.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: URL_BASE,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `node tests/e2e/preparar-base.mjs && npx next build && npx next start -p ${PUERTO}`,
    url: URL_BASE,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      ...envPruebas,
      APP_URL: URL_BASE,
      TAREAS_TOKEN: "token-pruebas-e2e",
    },
  },
});
