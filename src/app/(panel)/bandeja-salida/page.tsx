import type { Metadata } from "next";
import { clasesBoton } from "@/components/ui/boton";
import { Selector } from "@/components/ui/campo";
import { EncabezadoPagina, EstadoVacio, Insignia } from "@/components/ui/estructura";
import { Paginacion, leerPagina } from "@/components/ui/paginacion";
import type { CanalNotificacion, EstadoNotificacion } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatearFechaHora } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";

export const metadata: Metadata = { title: "Bandeja de salida" };

const POR_PAGINA = 20;
const canales: CanalNotificacion[] = ["correo", "sms"];
const estados: EstadoNotificacion[] = ["pendiente", "enviada"];

/** Bandeja de salida simulada: muestra los correos y SMS que el sistema "envía". */
export default async function PaginaBandejaSalida({ searchParams }: PageProps<"/bandeja-salida">) {
  await requerirRol("administrador");
  const parametros = await searchParams;
  const canal = canales.includes(parametros.canal as CanalNotificacion)
    ? (parametros.canal as CanalNotificacion)
    : undefined;
  const estado = estados.includes(parametros.estado as EstadoNotificacion)
    ? (parametros.estado as EstadoNotificacion)
    : undefined;
  const pagina = leerPagina(parametros.pagina);

  const filtro = { ...(canal ? { canal } : {}), ...(estado ? { estado } : {}) };
  const [total, mensajes] = await Promise.all([
    db.notificacion.count({ where: filtro }),
    db.notificacion.findMany({
      where: filtro,
      orderBy: [{ fechaProgramada: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Bandeja de salida"
        descripcion="Mensajes de correo y SMS registrados por el sistema. En este prototipo no se envían a destinatarios reales."
      />

      <form className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Selector
          nombre="canal"
          etiqueta="Canal"
          textoVacio="Todos"
          opciones={[
            { valor: "correo", etiqueta: "Correo electrónico" },
            { valor: "sms", etiqueta: "SMS" },
          ]}
          defaultValue={canal ?? ""}
        />
        <Selector
          nombre="estado"
          etiqueta="Estado"
          textoVacio="Todos"
          opciones={[
            { valor: "pendiente", etiqueta: "Pendiente de envío" },
            { valor: "enviada", etiqueta: "Enviado" },
          ]}
          defaultValue={estado ?? ""}
        />
        <button type="submit" className={clasesBoton("secundario")}>
          Filtrar
        </button>
      </form>

      {mensajes.length === 0 ? (
        <EstadoVacio titulo="No hay mensajes en la bandeja de salida">
          Aquí aparecerán los avisos de bloqueo, recuperación de contraseña, confirmaciones y recordatorios.
        </EstadoVacio>
      ) : (
        <ul className="space-y-3">
          {mensajes.map((mensaje) => (
            <li key={mensaje.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Insignia tono="info">{mensaje.canal === "correo" ? "Correo" : "SMS"}</Insignia>
                <Insignia tono={mensaje.estado === "enviada" ? "exito" : "advertencia"}>
                  {mensaje.estado === "enviada" ? "Enviado" : "Pendiente"}
                </Insignia>
                <span className="text-sm text-slate-700">
                  {mensaje.fechaEnvio
                    ? `Enviado el ${formatearFechaHora(mensaje.fechaEnvio)}`
                    : `Programado para el ${formatearFechaHora(mensaje.fechaProgramada)}`}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                Para: <span className="font-medium break-all text-slate-900">{mensaje.destinatario}</span> · Tipo:{" "}
                {mensaje.tipo.replaceAll("_", " ")}
              </p>
              {mensaje.asunto ? <p className="mt-1 font-semibold">{mensaje.asunto}</p> : null}
              <p className="mt-1 break-words whitespace-pre-line text-slate-800">{mensaje.contenido}</p>
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        pagina={pagina}
        totalPaginas={Math.ceil(total / POR_PAGINA)}
        ruta="/bandeja-salida"
        parametros={{ canal, estado }}
      />
    </>
  );
}
