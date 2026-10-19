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
  played: number;
  goalDiff: number;
  points: number;
  qualifies: boolean;
}

export interface ZoneStandings {
  id: string;
  nombre: string;
  rows: StandingRow[];
}

export interface BracketMatch {
  round: string;
  home: Team;
  away: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: string | null;
  pending: boolean;
  scheduledTime?: string;
}
