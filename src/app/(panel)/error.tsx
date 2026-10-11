"use client";

import { EstadoError } from "@/components/estado-error";

export default function ErrorPanel(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <EstadoError {...props} />;
}
