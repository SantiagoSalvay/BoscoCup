import type { BracketMatch, Branch, HistorialMatch, LiveMatch, Sport, StandingRow, Team, ZoneStandings } from "@/types";
import type { ResultadoLetra, TeamDetail, TeamMatch } from "@/lib/team-detail";

/**
 * Datos de ejemplo para que la app se vea completa sin depender de Supabase.
 * Se usan automáticamente cuando no hay variables VITE_SUPABASE_* configuradas.
 */

const team = (id: string, name: string, shieldColor: string): Team => ({ id, name, shieldColor });

const T = {
  sanMartin: team("san-martin", "San Martín", "#2E5FA3"),
  belgrano: team("belgrano", "Belgrano", "#4FA7D9"),
  sarmiento: team("sarmiento", "Sarmiento", "#3E7D4C"),
  mitre: team("mitre", "Mitre", "#7A2E3A"),
  moreno: team("moreno", "Moreno", "#2B2D30"),
  guemes: team("guemes", "Güemes", "#B5362C"),
  rivadavia: team("rivadavia", "Rivadavia", "#D9A441"),
  alberdi: team("alberdi", "Alberdi", "#6B4FA3")
};

function row(team: Team, played: number, goalDiff: number, points: number, qualifies: boolean, amarillas = 0, rojas = 0): StandingRow {
  // Desglose aproximado a partir de los puntos (3/1/0), suficiente para la demo.
  const won = Math.min(played, Math.floor(points / 3));
  const drawn = Math.min(played - won, points - won * 3);
  const lost = played - won - drawn;
  const goalsFor = Math.max(goalDiff, 0) + played;
  return {
    team,
    position: 0,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst: goalsFor - goalDiff,
    goalDiff,
    points,
    amarillas,
    rojas,
    qualifies,
    empatado: false
  };
}

function zone(id: string, nombre: string, rows: StandingRow[]): ZoneStandings {
  return { id, nombre, completa: false, rows: rows.map((r, i) => ({ ...r, position: i + 1 })) };
}

function bracket(
  round: string,
  home: Team,
  away: Team,
  rest: { homeScore: number | null; awayScore: number | null; winnerId: string | null; pending: boolean; scheduledTime?: string }
): BracketMatch {
  return { round, home, away, penalesHome: null, penalesAway: null, ...rest };
}

function hist(id: string, home: Team, away: Team, homeScore: number, awayScore: number, roundLabel: string, date: string): HistorialMatch {
  return { id, home, away, homeScore, awayScore, penalesHome: null, penalesAway: null, roundLabel, date };
}

export function dataKey(sport: Sport, branch: Branch): string {
  return sport === "basquet" ? "basquet" : `${sport}:${branch}`;
}

interface SportData {
  live: LiveMatch[];
  zones: ZoneStandings[];
  bracket: BracketMatch[];
  historial: HistorialMatch[];
}

const futbolMasc: SportData = {
  live: [
    {
      id: "fm-1",
      sport: "futbol",
      branch: "masculino",
      ramaLabel: "Fútbol Masculino",
      home: T.belgrano,
      away: T.sarmiento,
      homeScore: 2,
      awayScore: 1,
      statusLabel: "EN VIVO · 32'",
      court: "Cancha 1"
    },
    {
      id: "fm-2",
      sport: "futbol",
      branch: "masculino",
      ramaLabel: "Fútbol Masculino",
      home: T.rivadavia,
      away: T.guemes,
      homeScore: 0,
      awayScore: 0,
      statusLabel: "EN VIVO · 50'",
      court: "Cancha 2"
    }
  ],
  zones: [
    zone("zona-a", "Zona A", [row(T.sanMartin, 3, 6, 9, true), row(T.belgrano, 3, 3, 7, true), row(T.sarmiento, 3, -1, 3, false)]),
    zone("zona-b", "Zona B", [row(T.mitre, 3, -2, 3, false), row(T.moreno, 3, -4, 1, false), row(T.guemes, 3, -2, 0, false)])
  ],
  bracket: [
    bracket("Semifinal", T.sanMartin, T.mitre, { homeScore: 2, awayScore: 1, winnerId: T.sanMartin.id, pending: false }),
    bracket("Final", T.sanMartin, T.belgrano, { homeScore: null, awayScore: null, winnerId: null, pending: true, scheduledTime: "18:00" })
  ],
  historial: [
    hist("h-fm-1", T.sanMartin, T.mitre, 2, 1, "Semifinal", "19/10"),
    hist("h-fm-2", T.belgrano, T.sarmiento, 2, 1, "Zona A", "18/10"),
    hist("h-fm-3", T.mitre, T.moreno, 3, 0, "Zona B", "18/10")
  ]
};

const futbolFem: SportData = {
  live: [
    {
      id: "ff-1",
      sport: "futbol",
      branch: "femenino",
      ramaLabel: "Fútbol Femenino",
      home: T.alberdi,
      away: T.rivadavia,
      homeScore: 1,
      awayScore: 1,
      statusLabel: "EN VIVO · 40'",
      court: "Cancha 2"
    }
  ],
  zones: [
    zone("unica", "", [row(T.belgrano, 2, 3, 6, true), row(T.alberdi, 2, 1, 4, true), row(T.rivadavia, 2, -1, 1, false), row(T.sarmiento, 2, -3, 0, false)])
  ],
  bracket: [bracket("Final", T.belgrano, T.alberdi, { homeScore: null, awayScore: null, winnerId: null, pending: true, scheduledTime: "17:30" })],
  historial: [hist("h-ff-1", T.belgrano, T.sarmiento, 3, 1, "Fase de grupos", "18/10")]
};

const voleyMasc: SportData = {
  live: [
    {
      id: "vm-1",
      sport: "voley",
      branch: "masculino",
      ramaLabel: "Vóley Masculino",
      home: T.mitre,
      away: T.guemes,
      homeScore: 2,
      awayScore: 1,
      statusLabel: "EN VIVO · SET 4",
      court: "Cancha 3"
    }
  ],
  zones: [
    zone("unica", "", [row(T.mitre, 3, 4, 8, true), row(T.guemes, 3, 1, 6, true), row(T.moreno, 3, -2, 3, false), row(T.sanMartin, 3, -3, 2, false)])
  ],
  bracket: [bracket("Final", T.mitre, T.guemes, { homeScore: null, awayScore: null, winnerId: null, pending: true, scheduledTime: "16:45" })],
  historial: [hist("h-vm-1", T.mitre, T.moreno, 3, 1, "Fase de grupos", "18/10")]
};

const voleyFem: SportData = {
  live: [
    {
      id: "vf-1",
      sport: "voley",
      branch: "femenino",
      ramaLabel: "Vóley Femenino",
      home: T.sanMartin,
      away: T.moreno,
      homeScore: 2,
      awayScore: 1,
      statusLabel: "EN VIVO · SET 4",
      court: "Cancha 4"
    }
  ],
  zones: [
    zone("unica", "", [row(T.sanMartin, 3, 5, 9, true), row(T.belgrano, 3, 2, 6, true), row(T.moreno, 3, -3, 2, false), row(T.alberdi, 3, -4, 1, false)])
  ],
  bracket: [bracket("Final", T.sanMartin, T.belgrano, { homeScore: null, awayScore: null, winnerId: null, pending: true, scheduledTime: "17:00" })],
  historial: [hist("h-vf-1", T.sanMartin, T.alberdi, 3, 2, "Fase de grupos", "18/10")]
};

const basquet: SportData = {
  live: [
    {
      id: "b-1",
      sport: "basquet",
      branch: "masculino",
      ramaLabel: "Básquet",
      home: T.mitre,
      away: T.guemes,
      homeScore: 41,
      awayScore: 38,
      statusLabel: "EN VIVO · C3 5:12",
      court: "Cancha 5"
    }
  ],
  zones: [
    zone("unica", "", [row(T.mitre, 3, 12, 3, true), row(T.belgrano, 3, 4, 2, true), row(T.guemes, 3, -6, 1, false), row(T.sarmiento, 3, -10, 0, false)])
  ],
  bracket: [bracket("Final", T.mitre, T.belgrano, { homeScore: null, awayScore: null, winnerId: null, pending: true, scheduledTime: "19:00" })],
  historial: [hist("h-b-1", T.mitre, T.sarmiento, 52, 40, "Fase de grupos", "18/10")]
};

const byKey: Record<string, SportData> = {
  "futbol:masculino": futbolMasc,
  "futbol:femenino": futbolFem,
  "voley:masculino": voleyMasc,
  "voley:femenino": voleyFem,
  basquet
};

export function getMockData(sport: Sport, branch: Branch): SportData {
  return byKey[dataKey(sport, branch)] ?? { live: [], zones: [], bracket: [], historial: [] };
}

export function getMockAllLiveMatches(): LiveMatch[] {
  return Object.values(byKey).flatMap((d) => d.live);
}

export function getMockLiveCount(): number {
  return getMockAllLiveMatches().length;
}

/** Ficha de equipo armada con la tabla e historial de ejemplo (sin plantel). */
export function getMockTeamDetail(teamId: string, sport: Sport, branch: Branch): TeamDetail | null {
  const data = getMockData(sport, branch);
  const zona = data.zones.find((z) => z.rows.some((r) => r.team.id === teamId));
  const standing = zona?.rows.find((r) => r.team.id === teamId);
  if (!zona || !standing) return null;

  const matches: TeamMatch[] = data.historial
    .filter((m) => m.home.id === teamId || m.away.id === teamId)
    .map((m) => {
      const isHome = m.home.id === teamId;
      const gf = isHome ? m.homeScore : m.awayScore;
      const ga = isHome ? m.awayScore : m.homeScore;
      const result: ResultadoLetra = gf === ga ? "E" : gf > ga ? "G" : "P";
      return {
        id: m.id,
        rival: isHome ? m.away : m.home,
        isHome,
        goalsFor: gf,
        goalsAgainst: ga,
        penalesFor: null,
        penalesAgainst: null,
        status: "finalizado",
        result,
        roundLabel: m.roundLabel,
        when: m.date,
        court: ""
      };
    });

  const label = { futbol: "Fútbol", voley: "Vóley", basquet: "Básquet" }[sport];
  return {
    team: standing.team,
    sport,
    categoriaLabel: sport === "basquet" ? label : `${label} ${branch === "masculino" ? "Masculino" : "Femenino"}`,
    zoneName: zona.nombre,
    zoneSize: zona.rows.length,
    standing,
    players: [],
    matches,
    form: matches.map((m) => m.result as ResultadoLetra).slice(0, 5)
  };
}
