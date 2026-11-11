import type { Categoria } from "@/lib/db-types";

/** "Fútbol · Masculino", "Vóley · Mixto". */
export function categoriaLabel(c: Pick<Categoria, "deporte" | "rama">): string {
  const deporte = c.deporte === "voley" ? "Vóley" : "Fútbol";
  return `${deporte} · ${c.rama}`;
}
