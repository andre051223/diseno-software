"use client";

import { EstadoError } from "@/components/estado-error";

export default function ErrorPublico(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <EstadoError {...props} />
    </div>
  );
}
