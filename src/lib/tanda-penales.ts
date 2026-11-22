import type { EventoPartidoRow } from "@/lib/db-types";
import { FUTBOL } from "@/lib/reglas";

/**
 * Tanda de penales tiro por tiro: alternan los equipos, `FUTBOL.penalesPorEquipo` (3) tiros cada uno y,
 * si siguen iguales, muerte súbita (un tiro cada uno hasta que uno falle).
 * Se corta apenas uno ya no puede alcanzar al otro.
 */

export interface Tiro {
  equipoId: string;
  convertido: boolean;
}

export interface EstadoTanda {
  /** Goles de la tanda por equipo. */
  goles: Record<string, number>;
  /** Tiros de cada equipo en orden (true = convertido). */
  tiros: Record<string, boolean[]>;
  /** A quién le toca patear (null si ya hay ganador). */
  turno: string | null;
  /** Número de tiro que se está pateando (1, 2… ; > porEquipo es muerte súbita). */
  ronda: number;
  muerteSubita: boolean;
  ganador: string | null;
}

export function tirosDesdeEventos(eventos: EventoPartidoRow[]): Tiro[] {
  return eventos
    .filter((e) => !e.anulado && e.equipo_id && (e.tipo === "tanda_convertido" || e.tipo === "tanda_errado"))
    .map((e) => ({ equipoId: e.equipo_id as string, convertido: e.tipo === "tanda_convertido" }));
}

export function estadoTanda(tiros: Tiro[], primero: string, segundo: string, porEquipo: number = FUTBOL.penalesPorEquipo): EstadoTanda {
  const a = tiros.filter((t) => t.equipoId === primero).map((t) => t.convertido);
  const b = tiros.filter((t) => t.equipoId === segundo).map((t) => t.convertido);
  const ga = a.filter(Boolean).length;
  const gb = b.filter(Boolean).length;
  const na = a.length;
  const nb = b.length;

  let ganador: string | null = null;
  if (na < porEquipo || nb < porEquipo) {
    // Dentro de la tanda: ¿alguno ya no lo alcanza ni metiendo todos los que le quedan?
    if (ga + (porEquipo - na) < gb) ganador = segundo;
    else if (gb + (porEquipo - nb) < ga) ganador = primero;
  } else if (na === nb && ga !== gb) {
    // Completaron la tanda (o una ronda de muerte súbita) y hay diferencia.
    ganador = ga > gb ? primero : segundo;
  }

  const ronda = na === nb ? na + 1 : na;
  return {
    goles: { [primero]: ga, [segundo]: gb },
    tiros: { [primero]: a, [segundo]: b },
    turno: ganador ? null : na === nb ? primero : segundo,
    ronda,
    muerteSubita: ronda > porEquipo,
    ganador
  };
}
