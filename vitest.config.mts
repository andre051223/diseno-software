import path from "node:path";
import { defineConfig } from "vitest/config";

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
    // Las pruebas usan una base SQLite propia, distinta de la de desarrollo.
    env: { DATABASE_URL: "file:./prisma/test.db", TZ: "UTC" },
    globalSetup: ["tests/unit/preparar-base.ts"],
    // SQLite admite un solo escritor: los archivos de prueba se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
