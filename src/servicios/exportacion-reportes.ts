import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatearFechaHora } from "@/lib/fechas";
import type { DocumentoReporte, TablaReporte } from "./documentos-reporte";

const NOMBRE_HOSPITAL = "Hospital Central San Rafael";

// ---------------------------------------------------------------------------
// RF-35: exportación a CSV
// ---------------------------------------------------------------------------

/** Separador de columnas: punto y coma, el que espera Excel con configuración regional colombiana. */
const SEPARADOR_CSV = ";";

function celdaCsv(valor: string): string {
  return /[";\r\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

function lineaCsv(celdas: string[]): string {
  return celdas.map(celdaCsv).join(SEPARADOR_CSV);
}

/**
 * RF-35: genera el CSV de un reporte con los filtros aplicados en el encabezado.
 * Incluye la marca BOM para que Excel reconozca las tildes (UTF-8).
 */
export function generarCsv(documento: DocumentoReporte, generadoEn: Date = new Date()): string {
  const lineas: string[] = [
    lineaCsv([`${documento.titulo} (${documento.requisito})`]),
    lineaCsv([NOMBRE_HOSPITAL]),
    ...documento.filtros.map((filtro) => lineaCsv([filtro])),
    lineaCsv([`Generado: ${formatearFechaHora(generadoEn)}`]),
  ];
  for (const tabla of documento.tablas) {
    lineas.push("", lineaCsv([tabla.titulo]), lineaCsv(tabla.columnas));
    for (const fila of tabla.filas) lineas.push(lineaCsv(fila));
    if (tabla.total) lineas.push(lineaCsv(tabla.total));
  }
  lineas.push("", ...documento.notas.map((nota) => lineaCsv([`Nota: ${nota}`])));
  return `﻿${lineas.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------------------
// RF-35: exportación a PDF
// ---------------------------------------------------------------------------

// Hoja A4 vertical, en puntos.
const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 40;
const ANCHO_UTIL = ANCHO - MARGEN * 2;
const TAMANO_TEXTO = 9;
const ALTO_FILA = 16;
const PETROLEO = rgb(0.031, 0.184, 0.216); // #082f37
const PETROLEO_CLARO = rgb(0.933, 0.965, 0.969); // #eef6f7
const GRIS = rgb(0.278, 0.333, 0.412); // #475569
const LINEA = rgb(0.886, 0.91, 0.941); // #e2e8f0

type Fuentes = { normal: PDFFont; negrita: PDFFont };

/** Reemplaza los caracteres que la fuente estándar no puede dibujar (fuera de WinAnsi). */
function textoSeguro(texto: string, fuente: PDFFont): string {
  const admitidos = new Set(fuente.getCharacterSet());
  return Array.from(texto)
    .map((caracter) => (admitidos.has(caracter.codePointAt(0)!) ? caracter : "?"))
    .join("");
}

/** Recorta el texto con «…» si no cabe en el ancho indicado. */
function ajustarAncho(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  if (fuente.widthOfTextAtSize(texto, tamano) <= ancho) return texto;
  let recortado = texto;
  while (recortado.length > 1 && fuente.widthOfTextAtSize(`${recortado}…`, tamano) > ancho) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado}…`;
}

/** Divide un texto en líneas que caben en el ancho indicado. */
function dividirEnLineas(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(" ")) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (actual && fuente.widthOfTextAtSize(candidata, tamano) > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidata;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** La primera columna (nombres) ocupa más espacio; las demás se reparten por igual. */
function anchosColumnas(cantidad: number): number[] {
  const primera = cantidad > 4 ? ANCHO_UTIL * 0.3 : ANCHO_UTIL * 0.4;
  const resto = (ANCHO_UTIL - primera) / (cantidad - 1);
  return [primera, ...Array.from({ length: cantidad - 1 }, () => resto)];
}

class EscritorPdf {
  private pagina!: PDFPage;
  private y = 0;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly fuentes: Fuentes,
  ) {
    this.nuevaPagina();
  }

  nuevaPagina() {
    this.pagina = this.pdf.addPage([ANCHO, ALTO]);
    this.y = ALTO - MARGEN;
  }

  /** Salta de página si no queda el alto indicado. */
  reservar(alto: number): boolean {
    if (this.y - alto < MARGEN + 20) {
      this.nuevaPagina();
      return true;
    }
    return false;
  }

  texto(texto: string, opciones: { tamano?: number; negrita?: boolean; color?: ReturnType<typeof rgb>; espacio?: number } = {}) {
    const tamano = opciones.tamano ?? TAMANO_TEXTO;
    const fuente = opciones.negrita ? this.fuentes.negrita : this.fuentes.normal;
    for (const linea of dividirEnLineas(textoSeguro(texto, fuente), fuente, tamano, ANCHO_UTIL)) {
      this.reservar(tamano + 4);
      this.y -= tamano;
      this.pagina.drawText(linea, { x: MARGEN, y: this.y, size: tamano, font: fuente, color: opciones.color ?? PETROLEO });
      this.y -= 4;
    }
    this.y -= opciones.espacio ?? 0;
  }

  private fila(celdas: string[], anchos: number[], estilo: "encabezado" | "normal" | "total") {
    const negrita = estilo !== "normal";
    const fuente = negrita ? this.fuentes.negrita : this.fuentes.normal;
    // Los encabezados largos se reparten en dos líneas.
    const lineasPorCelda = celdas.map((celda, indice) =>
      estilo === "encabezado"
        ? dividirEnLineas(textoSeguro(celda, fuente), fuente, TAMANO_TEXTO, anchos[indice] - 8).slice(0, 3)
        : [ajustarAncho(textoSeguro(celda, fuente), fuente, TAMANO_TEXTO, anchos[indice] - 8)],
    );
    const alto = ALTO_FILA + (Math.max(...lineasPorCelda.map((lineas) => lineas.length)) - 1) * (TAMANO_TEXTO + 2);

    if (estilo !== "normal") {
      this.pagina.drawRectangle({ x: MARGEN, y: this.y - alto, width: ANCHO_UTIL, height: alto, color: PETROLEO_CLARO });
    }
    let x = MARGEN;
    lineasPorCelda.forEach((lineas, indice) => {
      lineas.forEach((linea, numero) => {
        // Las cifras se alinean a la derecha para compararlas mejor.
        const ancho = fuente.widthOfTextAtSize(linea, TAMANO_TEXTO);
        const posicionX = indice === 0 ? x + 4 : x + anchos[indice] - 4 - ancho;
        this.pagina.drawText(linea, {
          x: posicionX,
          y: this.y - 11 - numero * (TAMANO_TEXTO + 2),
          size: TAMANO_TEXTO,
          font: fuente,
          color: PETROLEO,
        });
      });
      x += anchos[indice];
    });
    this.y -= alto;
    this.pagina.drawLine({
      start: { x: MARGEN, y: this.y },
      end: { x: MARGEN + ANCHO_UTIL, y: this.y },
      thickness: 0.5,
      color: LINEA,
    });
  }

  tabla(tabla: TablaReporte) {
    const anchos = anchosColumnas(tabla.columnas.length);
    this.reservar(ALTO_FILA * 4);
    this.texto(tabla.titulo, { tamano: 11, negrita: true, espacio: 2 });
    this.fila(tabla.columnas, anchos, "encabezado");
    if (tabla.filas.length === 0) {
      this.texto("No hay datos para los filtros aplicados.", { color: GRIS });
    }
    for (const fila of tabla.filas) {
      // El encabezado se repite en cada página nueva.
      if (this.reservar(ALTO_FILA)) this.fila(tabla.columnas, anchos, "encabezado");
      this.fila(fila, anchos, "normal");
    }
    if (tabla.total) {
      this.reservar(ALTO_FILA);
      this.fila(tabla.total, anchos, "total");
    }
    this.y -= 14;
  }
}

/** RF-35: genera el PDF de un reporte con los filtros aplicados en el encabezado. */
export async function generarPdf(documento: DocumentoReporte, generadoEn: Date = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${documento.titulo} - ${NOMBRE_HOSPITAL}`);
  pdf.setAuthor(NOMBRE_HOSPITAL);
  pdf.setSubject(`Reporte de gestión ${documento.requisito}`);
  pdf.setLanguage("es-CO");
  pdf.setCreationDate(generadoEn);

  const fuentes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const escritor = new EscritorPdf(pdf, fuentes);

  escritor.texto(NOMBRE_HOSPITAL, { tamano: 10, color: GRIS });
  escritor.texto(documento.titulo, { tamano: 16, negrita: true, espacio: 4 });
  escritor.texto(documento.filtros.join("   ·   "), { espacio: 0 });
  escritor.texto(`Generado: ${formatearFechaHora(generadoEn)}`, { color: GRIS, espacio: 12 });

  for (const tabla of documento.tablas) escritor.tabla(tabla);
  for (const nota of documento.notas) escritor.texto(`Nota: ${nota}`, { color: GRIS });

  // Numeración de páginas al pie.
  const paginas = pdf.getPages();
  paginas.forEach((pagina, indice) => {
    const texto = `${documento.requisito} · Página ${indice + 1} de ${paginas.length}`;
    const ancho = fuentes.normal.widthOfTextAtSize(texto, 8);
    pagina.drawText(texto, { x: ANCHO - MARGEN - ancho, y: MARGEN / 2, size: 8, font: fuentes.normal, color: GRIS });
  });

  return pdf.save();
}
