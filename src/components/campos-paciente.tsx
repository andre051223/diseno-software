import { Campo, Selector } from "@/components/ui/campo";
import { listaTiposDocumento, nombresTipoDocumento } from "@/lib/etiquetas";
import { aFechaIso } from "@/lib/fechas";
import type { EstadoFormulario } from "@/lib/validaciones/comunes";

export type OpcionAseguradora = { valor: number; etiqueta: string };

/** RF-05: campos que se solicitan al registrar un paciente por cualquier canal. */
export function CamposPaciente({
  aseguradoras,
  estado,
}: {
  aseguradoras: OpcionAseguradora[];
  estado: EstadoFormulario;
}) {
  const valores = estado.valores;
  const errores = estado.errores;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Selector
        nombre="tipoDocumento"
        etiqueta="Tipo de documento"
        required
        textoVacio="Seleccione el tipo"
        opciones={listaTiposDocumento.map((tipo) => ({ valor: tipo, etiqueta: nombresTipoDocumento[tipo] }))}
        defaultValue={valores?.tipoDocumento ?? ""}
        errores={errores?.tipoDocumento}
      />
      <Campo
        nombre="numeroDocumento"
        etiqueta="Número de documento"
        required
        inputMode="text"
        autoComplete="off"
        ayuda="Sin puntos ni espacios."
        defaultValue={valores?.numeroDocumento}
        errores={errores?.numeroDocumento}
      />
      <Campo
        nombre="nombres"
        etiqueta="Nombres"
        required
        autoComplete="given-name"
        defaultValue={valores?.nombres}
        errores={errores?.nombres}
      />
      <Campo
        nombre="apellidos"
        etiqueta="Apellidos"
        required
        autoComplete="family-name"
        defaultValue={valores?.apellidos}
        errores={errores?.apellidos}
      />
      <Campo
        nombre="fechaNacimiento"
        etiqueta="Fecha de nacimiento"
        type="date"
        required
        max={aFechaIso(new Date())}
        min="1900-01-01"
        ayuda="Formato dd/mm/aaaa."
        defaultValue={valores?.fechaNacimiento}
        errores={errores?.fechaNacimiento}
      />
      <Campo
        nombre="telefono"
        etiqueta="Teléfono celular"
        type="tel"
        required
        inputMode="numeric"
        autoComplete="tel-national"
        ayuda="Allí le enviaremos los mensajes de texto de sus citas."
        defaultValue={valores?.telefono}
        errores={errores?.telefono}
      />
      <Campo
        nombre="correo"
        etiqueta="Correo electrónico"
        type="email"
        required
        autoComplete="email"
        defaultValue={valores?.correo}
        errores={errores?.correo}
      />
      <Selector
        nombre="aseguradoraId"
        etiqueta="Aseguradora"
        required
        textoVacio="Seleccione la aseguradora"
        opciones={aseguradoras}
        defaultValue={valores?.aseguradoraId ?? ""}
        errores={errores?.aseguradoraId}
      />
    </div>
  );
}
