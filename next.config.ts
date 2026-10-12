import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La aplicación trabaja con datos que cambian en cada solicitud (agenda, citas),
  // por eso no se activa Cache Components y todas las páginas con sesión son dinámicas.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
