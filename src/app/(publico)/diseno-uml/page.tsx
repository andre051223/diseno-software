import type { Metadata } from "next";
import Image from "next/image";
import {
  ContenedorTabla,
  EncabezadoPagina,
  Insignia,
  Tarjeta,
  clasesCeldaTabla,
  clasesEncabezadoTabla,
} from "@/components/ui/estructura";
import { diagramas, etiquetasRelacion, trazabilidad, type Relacion } from "@/lib/diseno-uml";

export const metadata: Metadata = { title: "Diseño UML" };

const tonosRelacion: Record<Relacion, "neutro" | "info" | "advertencia"> = {
  asociacion: "neutro",
  include: "info",
  extend: "advertencia",
};

export default function PaginaDisenoUml() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <EncabezadoPagina
        titulo="Diseño UML del sistema"
        descripcion="Estos diagramas de casos de uso modelan los 35 requisitos funcionales definidos en el eje 1. Cada caso de uso CU-nn representa al requisito RF-nn con el mismo número."
      />

      <div className="flex flex-col gap-6">
        {diagramas.map((diagrama) => (
          <Tarjeta key={diagrama.id}>
            <article id={diagrama.id} className="scroll-mt-4" aria-labelledby={`titulo-${diagrama.id}`}>
              <h2 id={`titulo-${diagrama.id}`} className="text-xl font-semibold">
                {diagrama.titulo}
              </h2>
              <p className="mt-2 text-slate-700">{diagrama.descripcion}</p>

              <div
                className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white"
                role="region"
                aria-label={`Diagrama: ${diagrama.titulo}. Desplace horizontalmente para verlo completo.`}
                tabIndex={0}
              >
                <Image
                  src={diagrama.archivo}
                  alt={diagrama.alt}
                  width={diagrama.ancho}
                  height={diagrama.alto}
                  className="h-auto w-full min-w-[40rem] max-w-none sm:min-w-0"
                />
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Requisitos que cubre</h3>
                  <ul className="mt-1 flex flex-wrap gap-1.5" aria-label={`Requisitos de ${diagrama.titulo}`}>
                    {diagrama.requisitos.map((requisito) => (
                      <li key={requisito}>
                        <Insignia tono="info">{requisito}</Insignia>
                      </li>
                    ))}
                  </ul>
                </div>
                <a
                  href={diagrama.archivo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 font-semibold text-petroleo-700 underline underline-offset-2 hover:text-petroleo-900"
                >
                  Abrir en tamaño completo
                  <span className="sr-only"> el diagrama {diagrama.titulo} (se abre en una pestaña nueva)</span>
                </a>
              </div>
            </article>
          </Tarjeta>
        ))}

        <Tarjeta titulo="Trazabilidad de requisitos a casos de uso">
          <p className="mb-4 text-slate-700">
            Relación de cada requisito funcional con su caso de uso, el actor que lo inicia y el tipo de relación
            que tiene en el diagrama.
          </p>
          <ContenedorTabla etiqueta="Trazabilidad de requisitos a casos de uso">
            <thead>
              <tr>
                <th scope="col" className={clasesEncabezadoTabla}>RF</th>
                <th scope="col" className={clasesEncabezadoTabla}>Caso de uso</th>
                <th scope="col" className={clasesEncabezadoTabla}>Actor</th>
                <th scope="col" className={clasesEncabezadoTabla}>Relación en el diagrama</th>
              </tr>
            </thead>
            <tbody>
              {trazabilidad.map((fila) => (
                <tr key={fila.rf}>
                  <th scope="row" className={`${clasesCeldaTabla} whitespace-nowrap font-semibold`}>
                    {fila.rf}
                  </th>
                  <td className={clasesCeldaTabla}>
                    <span className="whitespace-nowrap font-medium">{fila.cu}</span> {fila.casoUso}
                  </td>
                  <td className={clasesCeldaTabla}>{fila.actor}</td>
                  <td className={clasesCeldaTabla}>
                    <Insignia tono={tonosRelacion[fila.relacion]}>{etiquetasRelacion[fila.relacion]}</Insignia>
                    {fila.detalle ? <span className="ml-2 text-sm text-slate-700">{fila.detalle}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </ContenedorTabla>
        </Tarjeta>
      </div>
    </div>
  );
}
