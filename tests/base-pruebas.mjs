// Base PostgreSQL exclusiva de las pruebas: se borra y se recrea en cada ejecución,
// así que nunca debe ser la de desarrollo ni la de producción.
import "dotenv/config";

const url = process.env.DATABASE_URL_PRUEBAS;
if (!url) {
  throw new Error("Defina DATABASE_URL_PRUEBAS con una base PostgreSQL exclusiva para las pruebas (ver README).");
}
if (url === process.env.DATABASE_URL || url === process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("DATABASE_URL_PRUEBAS no puede ser la misma base que DATABASE_URL: las pruebas borran todos los datos.");
}

/** Variables que dirigen Prisma, la semilla y la aplicación a la base de pruebas. */
export const envPruebas = { DATABASE_URL: url, DATABASE_URL_UNPOOLED: url };
