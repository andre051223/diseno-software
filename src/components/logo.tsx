import Link from "next/link";

/** Marca del hospital: cruz sobre fondo azul petróleo y nombre. */
export function Logo({ href = "/", claro = false }: { href?: string; claro?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg">
      <span
        aria-hidden="true"
        className={`flex size-9 items-center justify-center rounded-lg ${claro ? "bg-white" : "bg-petroleo-700"}`}
      >
        <svg viewBox="0 0 24 24" className={`size-5 ${claro ? "fill-petroleo-700" : "fill-white"}`}>
          <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
        </svg>
      </span>
      <span className={`leading-tight ${claro ? "text-white" : "text-petroleo-900"}`}>
        <span className="block text-sm">Hospital Central</span>
        <span className="block font-bold">San Rafael</span>
      </span>
    </Link>
  );
}
