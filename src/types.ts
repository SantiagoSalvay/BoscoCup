export type Sport = "futbol" | "voley";
/** Fútbol se juega en masculino y femenino; vóley es una sola rama mixta. */
export type Branch = "masculino" | "femenino" | "mixto";

export interface Team {
  id: string;
  name: string;
  shieldColor: string;
}

export interface LiveMatch {
  id: string;
  sport: Sport;
  branch: Branch;
  ramaLabel: string;
  home: Team;
  away: Team;
  homeScore: number;
  awayScore: number;
  statusLabel: string;
  court: string;
}

export interface StandingRow {
  team: Team;
  /** Puesto dentro de su zona (1 = primero). */
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  /** Vóley: diferencia de tantos (puntos dentro de los sets), tercer criterio de desempate. */
  tantosDiff?: number;
  points: number;
  amarillas: number;
  rojas: number;
  qualifies: boolean;
  /**
   * Empatado en puntos, DG, amarillas y rojas con el equipo de al lado — hace
   * falta partido de desempate. Solo se marca con la zona ya terminada.
   */
  empatado: boolean;
}

export interface ZoneStandings {
  id: string;
  nombre: string;
  /** Fase de grupos terminada: todos contra todos jugado y sin partidos pendientes. */
  completa: boolean;
  rows: StandingRow[];
}

export interface BracketMatch {
  id?: string;
  round: string;
  /** Lugar dentro de la ronda (0, 1, 2…): ubica el partido en el cuadro. */
  pos?: number | null;
  home: Team;
  away: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  penalesHome: number | null;
  penalesAway: number | null;
  winnerId: string | null;
  pending: boolean;
  scheduledTime?: string;
  court?: string;
  /** Partido en juego: muestra el marcador del momento y quién va ganando. */
  enVivo?: boolean;
  /**
   * Cruce que todavía no existe: se arma con la tabla del momento (o con quien
   * va ganando un partido en juego) y cambia con cada gol.
   */
  proyectado?: boolean;
  /** Etiqueta de la siembra (1ºA, 2ºB…) en los cruces proyectados. */
  seedHome?: string;
  seedAway?: string;
}

/** Un partido en la grilla de horarios (todas las categorías). */
export interface HorarioMatch {
  id: string;
  sport: Sport;
  branch: Branch;
  /** "Fútbol Masculino", "Vóley Mixto"… */
  categoriaLabel: string;
  home: Team;
  /** null en un cruce que todavía espera rival. */
  away: Team | null;
  /** ISO de la hora programada (null si todavía no tiene). */
  fecha: string | null;
  court: string | null;
  /** Lugar en su cancha (1º, 2º…), cuando se juega "a continuación" sin hora fija. */
  orden: number | null;
  /** "Grupo A", "Liguilla", "Cuartos"… */
  roundLabel: string;
  estado: "programado" | "en_vivo" | "finalizado" | "suspendido";
  homeScore: number | null;
  awayScore: number | null;
  penalesHome: number | null;
  penalesAway: number | null;
}

export interface HistorialMatch {
  id: string;
  home: Team;
  away: Team;
  homeScore: number;
  awayScore: number;
  penalesHome: number | null;
  penalesAway: number | null;
  roundLabel: string;
  date: string;
}
