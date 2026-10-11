import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/** Cliente de Prisma compartido; se reutiliza entre recargas en desarrollo. */
function crearCliente() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({ adapter });
}

const globalParaPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof crearCliente>;
};

export const db = globalParaPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = db;
}

export type ClienteDb = typeof db;
/** Cliente válido dentro de una transacción interactiva. */
export type TransaccionDb = Parameters<Parameters<ClienteDb["$transaction"]>[0]>[0];
