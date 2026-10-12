import path from "node:path";
import { defineConfig } from "vitest/config";
import { envPruebas } from "./tests/base-pruebas.mjs";

const raiz = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(raiz, "src"),
      // `server-only` solo tiene sentido dentro de Next.js; en las pruebas se reemplaza por un módulo vacío.
      "server-only": path.join(raiz, "tests/unit/server-only-vacio.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Las pruebas usan una base PostgreSQL propia, distinta de la de desarrollo.
    env: { ...envPruebas, TZ: "UTC" },
    globalSetup: ["tests/unit/preparar-base.ts"],
    // Los archivos de prueba comparten la base: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
