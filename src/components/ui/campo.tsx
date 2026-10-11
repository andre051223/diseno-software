import type { ComponentProps, ReactNode } from "react";

const clasesControl =
  "block w-full min-h-11 rounded-lg border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-petroleo-600 aria-[invalid=true]:border-red-700";

type Comunes = {
  nombre: string;
  etiqueta: string;
  errores?: string[];
  ayuda?: ReactNode;
  className?: string;
};

function Mensajes({ id, errores, ayuda }: { id: string; errores?: string[]; ayuda?: ReactNode }) {
  return (
    <>
      {ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1 text-sm text-slate-600">
          {ayuda}
        </p>
      ) : null}
      {errores?.length ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">
          {errores.join(" ")}
        </p>
      ) : null}
    </>
  );
}

function describedBy(id: string, errores?: string[], ayuda?: ReactNode) {
  const ids = [ayuda ? `${id}-ayuda` : null, errores?.length ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

type PropiedadesCampo = Comunes & Omit<ComponentProps<"input">, "name">;

/** Campo de texto con etiqueta visible, ayuda y mensajes de error accesibles. */
export function Campo({ nombre, etiqueta, errores, ayuda, className = "", id, required, ...resto }: PropiedadesCampo) {
  const idCampo = id ?? `campo-${nombre}`;
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="mb-1 block font-medium text-slate-800">
        {etiqueta}
        {required ? <span className="text-red-700"> *</span> : null}
      </label>
      <input
        id={idCampo}
        name={nombre}
        required={required}
        aria-invalid={errores?.length ? true : undefined}
        aria-describedby={describedBy(idCampo, errores, ayuda)}
        className={clasesControl}
        {...resto}
      />
      <Mensajes id={idCampo} errores={errores} ayuda={ayuda} />
    </div>
  );
}

type PropiedadesSelector = Comunes &
  Omit<ComponentProps<"select">, "name"> & {
    opciones: { valor: string | number; etiqueta: string }[];
    textoVacio?: string;
  };

/** Lista desplegable con etiqueta visible. */
export function Selector({
  nombre,
  etiqueta,
  errores,
  ayuda,
  opciones,
  textoVacio,
  className = "",
  id,
  required,
  ...resto
}: PropiedadesSelector) {
  const idCampo = id ?? `campo-${nombre}`;
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="mb-1 block font-medium text-slate-800">
        {etiqueta}
        {required ? <span className="text-red-700"> *</span> : null}
      </label>
      <select
        id={idCampo}
        name={nombre}
        required={required}
        aria-invalid={errores?.length ? true : undefined}
        aria-describedby={describedBy(idCampo, errores, ayuda)}
        className={clasesControl}
        {...resto}
      >
        {textoVacio !== undefined ? <option value="">{textoVacio}</option> : null}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      <Mensajes id={idCampo} errores={errores} ayuda={ayuda} />
    </div>
  );
}

type PropiedadesAreaTexto = Comunes & Omit<ComponentProps<"textarea">, "name">;

export function AreaTexto({ nombre, etiqueta, errores, ayuda, className = "", id, required, ...resto }: PropiedadesAreaTexto) {
  const idCampo = id ?? `campo-${nombre}`;
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="mb-1 block font-medium text-slate-800">
        {etiqueta}
        {required ? <span className="text-red-700"> *</span> : null}
      </label>
      <textarea
        id={idCampo}
        name={nombre}
        required={required}
        aria-invalid={errores?.length ? true : undefined}
        aria-describedby={describedBy(idCampo, errores, ayuda)}
        className={`${clasesControl} min-h-24`}
        {...resto}
      />
      <Mensajes id={idCampo} errores={errores} ayuda={ayuda} />
    </div>
  );
}

type PropiedadesCasilla = Omit<ComponentProps<"input">, "name" | "type"> & {
  nombre: string;
  etiqueta: string;
  ayuda?: ReactNode;
};

export function Casilla({ nombre, etiqueta, ayuda, id, ...resto }: PropiedadesCasilla) {
  const idCampo = id ?? `campo-${nombre}`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={idCampo}
        name={nombre}
        type="checkbox"
        className="mt-1 size-5 rounded border-slate-400 accent-petroleo-600"
        aria-describedby={ayuda ? `${idCampo}-ayuda` : undefined}
        {...resto}
      />
      <div>
        <label htmlFor={idCampo} className="font-medium text-slate-800">
          {etiqueta}
        </label>
        {ayuda ? (
          <p id={`${idCampo}-ayuda`} className="text-sm text-slate-600">
            {ayuda}
          </p>
        ) : null}
      </div>
    </div>
  );
}
