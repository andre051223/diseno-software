import Link from "next/link";
import { EnlaceBoton } from "@/components/ui/boton";

const pasos = [
  {
    titulo: "Agende en línea",
    texto: "Elija la especialidad, el médico y el horario que más le convenga, desde el computador o el celular.",
  },
  {
    titulo: "Validamos su cobertura",
    texto: "Consultamos con su aseguradora la vigencia y la cobertura antes de confirmar la cita.",
  },
  {
    titulo: "Reciba recordatorios",
    texto: "Le enviamos la confirmación y un recordatorio 48 horas antes para confirmar o cancelar.",
  },
  {
    titulo: "Llegue sin filas",
    texto: "Presente su documento o el código de la cita en recepción y espere el llamado del médico.",
  },
];

export default function PaginaInicio() {
  return (
    <>
      <section className="bg-petroleo-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h1 className="max-w-3xl text-3xl font-bold text-white sm:text-4xl">
            Sus citas médicas en el Hospital Central San Rafael, sin filas ni llamadas en espera
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-petroleo-50">
            Agende, reprograme o cancele sus citas en 12 especialidades. Reciba la confirmación por correo y
            mensaje de texto, y un recordatorio antes de su cita.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <EnlaceBoton href="/registro">Crear mi cuenta</EnlaceBoton>
            <EnlaceBoton href="/iniciar-sesion" variante="claro">
              Ya tengo cuenta
            </EnlaceBoton>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="text-2xl font-bold">
          ¿Cómo funciona?
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pasos.map((paso, indice) => (
            <li key={paso.titulo} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-full bg-petroleo-100 font-bold text-petroleo-800">
                {indice + 1}
              </span>
              <h3 className="mt-3 text-lg font-semibold">{paso.titulo}</h3>
              <p className="mt-1 text-slate-700">{paso.texto}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-xl border border-petroleo-200 bg-petroleo-50 p-5">
          <h2 className="text-xl font-semibold">¿Prefiere hacerlo por teléfono o en ventanilla?</h2>
          <p className="mt-1 text-slate-800">
            Nuestros agentes telefónicos y el personal de recepción usan el mismo sistema, así que su cita queda
            registrada igual sin importar el canal que elija.
          </p>
        </div>

        <p className="mt-6 text-slate-700">
          ¿Le interesa cómo está diseñado el sistema? Consulte los diagramas de casos de uso en{" "}
          <Link href="/diseno-uml" className="font-semibold text-petroleo-700 underline underline-offset-2 hover:text-petroleo-900">
            Diseño UML
          </Link>
          .
        </p>
      </section>
    </>
  );
}
