const numeroEntero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const numeroDecimal = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Número entero con separador de miles colombiano, por ejemplo «1.250». */
export function formatearEntero(valor: number): string {
  return numeroEntero.format(valor);
}

/** Número con un decimal y coma decimal, por ejemplo «12,5». Muestra «—» si no hay dato. */
export function formatearDecimal(valor: number | null): string {
  return valor === null ? "—" : numeroDecimal.format(valor);
}

/** Porcentaje con un decimal, por ejemplo «45,3 %». Muestra «—» si no hay base para calcularlo. */
export function formatearPorcentaje(valor: number | null): string {
  return valor === null ? "—" : `${numeroDecimal.format(valor)} %`;
}
