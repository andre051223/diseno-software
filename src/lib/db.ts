import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Cliente de Prisma compartido; se reutiliza entre recargas en desarrollo. */
function crearCliente() {
  // La conexión se abre en la primera consulta, así que compilar no exige DATABASE_URL.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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
