import { Prisma } from "@/generated/prisma/client";

/** Indica si el error proviene de un índice único de la base de datos (código P2002 de Prisma). */
export function esErrorUnico(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
