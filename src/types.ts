export type Sport = "futbol" | "voley" | "basquet";
export type Branch = "masculino" | "femenino";

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
  round: string;
  home: Team;
  away: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  penalesHome: number | null;
  penalesAway: number | null;
  winnerId: string | null;
  pending: boolean;
  scheduledTime?: string;
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
