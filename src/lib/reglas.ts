/**
 * Reglas de tiempo del torneo (fútbol masculino y femenino).
 *
 * - Puertas abren a las 8:00; el masculino arranca a las 10:00 y el femenino
 *   a las 12:30.
 * - Fase de grupos, octavos, cuartos, semis y 3er puesto: cada partido dura 25
 *   minutos en total (10' + 5' de descanso + 10') y al terminar uno arranca el siguiente.
 * - Final: 15' + 5' de descanso + 15' (turno de 35').
 * - En playoff, si terminan empatados, se define por penales (tanda de 3).
 * - Máximo 3 cambios por equipo en cada partido.
 *
 * La espera a que se presente un equipo la manejan los organizadores a mano,
 * así que no se suma al turno.
 */
/** Día del torneo: todos los partidos se juegan el domingo 22 de noviembre de 2026. */
export const DIA_TORNEO = { anio: 2026, mes: 11, dia: 22 } as const;

export const FUTBOL = {
  horaInicio: { horas: 10, minutos: 0 },
  /**
   * Arranca el femenino en la Cancha 3. Hasta esa hora el masculino usa las 3
   * canchas; desde ahí, solo la 1 y la 2 (grupos que falten y playoffs).
   */
  horaInicioFemenino: { horas: 12, minutos: 30 },
  /** El playoff (primera ronda) no arranca antes de esta hora, aunque los grupos terminen antes. */
  horaInicioPlayoff: { horas: 15, minutos: 30 },
  /** Tiempos de todos los partidos salvo la final (turno total de 25'). */
  minutosPorTiempoGrupos: 10,
  /** Tiempos de la final (turno total de 35'). */
  minutosPorTiempo: 15,
  minutosDescanso: 5,
  maxCambios: 3,
  /** Tiros por equipo en la tanda de penales; si siguen iguales, muerte súbita. */
  penalesPorEquipo: 3
} as const;

/** { horas: 12, minutos: 30 } → "12:30". */
export function horaTexto(h: { horas: number; minutos: number }): string {
  return `${h.horas}:${String(h.minutos).padStart(2, "0")}`;
}

/** Minutos que ocupa un partido de fase de grupos en la cancha (25'). */
export const FUTBOL_MINUTOS_POR_TURNO = FUTBOL.minutosPorTiempoGrupos * 2 + FUTBOL.minutosDescanso;

/** Rondas que se juegan con los tiempos cortos de la fase de grupos (todas menos la final). */
const RONDAS_CORTAS = new Set(["Octavos", "Cuartos", "Semifinal", "3er puesto"]);

/** Minutos de cada tiempo según la ronda (sin ronda = fase de grupos). */
export function minutosPorTiempo(ronda: string | null | undefined): number {
  return !ronda || RONDAS_CORTAS.has(ronda) ? FUTBOL.minutosPorTiempoGrupos : FUTBOL.minutosPorTiempo;
}

/** Minutos que ocupa en la cancha un partido de esa ronda. */
export function minutosDeTurno(ronda: string | null | undefined): number {
  return minutosPorTiempo(ronda) * 2 + FUTBOL.minutosDescanso;
}

/**
 * Fútbol femenino se juega como liguilla: un solo grupo, ida y vuelta (cada
 * partido se juega dos veces, local y visitante invertidos), en la Cancha 3,
 * arrancando a las 12:30 (desde esa hora el masculino ya no usa esa cancha), y
 * la campeona es la que más puntos suma. No hay cruces.
 */
export function esLiguilla(c: { deporte: string; rama: string } | null | undefined): boolean {
  return c?.deporte === "futbol" && c.rama === "Femenino";
}

/** Vueltas que se juegan en la fase de "grupos": liguilla femenino, 2 (ida y vuelta); el resto, 1. */
export function vueltasDeGrupo(c: { deporte: string; rama: string } | null | undefined): number {
  return esLiguilla(c) ? 2 : 1;
}

/**
 * Categorías sin cuadro de playoff: el fútbol femenino (liguilla, ida y
 * vuelta) y el vóley (todos contra todos, una sola vuelta). En las dos la
 * tabla sola decide el campeón; no hay cruces ni "clasificados".
 */
export function sinPlayoff(c: { deporte: string; rama: string } | null | undefined): boolean {
  return esLiguilla(c) || c?.deporte === "voley";
}

/** Nombre de la cancha fija del femenino (se busca por nombre, ej. "Cancha 3"). */
export const CANCHA_FEMENINO = /^cancha\s*3\b/i;

/**
 * Plantel de fútbol: máximo 10 jugadores por equipo. El mínimo depende de la
 * rama: masculino es fútbol 7 (mínimo 7) y femenino es fútbol 6 — 5 jugadoras
 * más la arquera (mínimo 6).
 */
export const PLANTEL_FUTBOL = { minimo: 7, maximo: 10 } as const;
export const PLANTEL_FUTBOL_FEMENINO = { minimo: 6, maximo: 10 } as const;

export function plantelFutbol(rama: string | null | undefined): { minimo: number; maximo: number } {
  return rama === "Femenino" ? PLANTEL_FUTBOL_FEMENINO : PLANTEL_FUTBOL;
}

/**
 * Tarjetas acumulativas. El reglamento no fija el número: acá se define.
 * - Roja directa o doble amarilla: no juega el partido siguiente.
 * - Cada AMARILLAS_PARA_SUSPENSION amarillas acumuladas (en partidos distintos):
 *   no juega el partido siguiente, y el contador vuelve a cero.
 */
export const AMARILLAS_PARA_SUSPENSION = 2;

/** Vóley: al mejor de 3 sets de 20 puntos, con 2 de diferencia. */
export const VOLEY = {
  puntosPorSet: 20,
  diferenciaMinima: 2,
  setsParaGanar: 2,
  /** Puntos en la tabla: ganar el partido (2-0 o 2-1) da 3, perderlo da 0. */
  puntosVictoria: 3,
  puntosDerrota: 0,
  /** Lo que se reserva de cancha por partido al programar los playoffs. */
  minutosPorTurno: 40
} as const;

/** true si el set ya se puede cerrar según el reglamento. */
export function setTerminado(a: number, b: number): boolean {
  return Math.max(a, b) >= VOLEY.puntosPorSet && Math.abs(a - b) >= VOLEY.diferenciaMinima;
}
