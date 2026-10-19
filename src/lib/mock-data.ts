import type { BracketMatch, Branch, LiveMatch, Sport, Team, ZoneStandings } from "@/types";

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

export function dataKey(sport: Sport, branch: Branch): string {
  return sport === "basquet" ? "basquet" : `${sport}:${branch}`;
}

interface SportData {
  live: LiveMatch[];
  zones: ZoneStandings[];
  bracket: BracketMatch[];
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
    {
      id: "zona-a",
      nombre: "Zona A",
      rows: [
        { team: T.sanMartin, played: 3, goalDiff: 6, points: 9, qualifies: true },
        { team: T.belgrano, played: 3, goalDiff: 3, points: 7, qualifies: true },
        { team: T.sarmiento, played: 3, goalDiff: -1, points: 3, qualifies: false }
      ]
    },
    {
      id: "zona-b",
      nombre: "Zona B",
      rows: [
        { team: T.mitre, played: 3, goalDiff: -2, points: 3, qualifies: false },
        { team: T.moreno, played: 3, goalDiff: -4, points: 1, qualifies: false },
        { team: T.guemes, played: 3, goalDiff: -2, points: 0, qualifies: false }
      ]
    }
  ],
  bracket: [
    {
      round: "Semifinal",
      home: T.sanMartin,
      away: T.mitre,
      homeScore: 2,
      awayScore: 1,
      winnerId: T.sanMartin.id,
      pending: false
    },
    {
      round: "Final",
      home: T.sanMartin,
      away: T.belgrano,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      pending: true,
      scheduledTime: "18:00"
    }
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
    {
      id: "unica",
      nombre: "",
      rows: [
        { team: T.belgrano, played: 2, goalDiff: 3, points: 6, qualifies: true },
        { team: T.alberdi, played: 2, goalDiff: 1, points: 4, qualifies: true },
        { team: T.rivadavia, played: 2, goalDiff: -1, points: 1, qualifies: false },
        { team: T.sarmiento, played: 2, goalDiff: -3, points: 0, qualifies: false }
      ]
    }
  ],
  bracket: [
    {
      round: "Final",
      home: T.belgrano,
      away: T.alberdi,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      pending: true,
      scheduledTime: "17:30"
    }
  ]
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
    {
      id: "unica",
      nombre: "",
      rows: [
        { team: T.mitre, played: 3, goalDiff: 4, points: 8, qualifies: true },
        { team: T.guemes, played: 3, goalDiff: 1, points: 6, qualifies: true },
        { team: T.moreno, played: 3, goalDiff: -2, points: 3, qualifies: false },
        { team: T.sanMartin, played: 3, goalDiff: -3, points: 2, qualifies: false }
      ]
    }
  ],
  bracket: [
    {
      round: "Final",
      home: T.mitre,
      away: T.guemes,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      pending: true,
      scheduledTime: "16:45"
    }
  ]
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
    {
      id: "unica",
      nombre: "",
      rows: [
        { team: T.sanMartin, played: 3, goalDiff: 5, points: 9, qualifies: true },
        { team: T.belgrano, played: 3, goalDiff: 2, points: 6, qualifies: true },
        { team: T.moreno, played: 3, goalDiff: -3, points: 2, qualifies: false },
        { team: T.alberdi, played: 3, goalDiff: -4, points: 1, qualifies: false }
      ]
    }
  ],
  bracket: [
    {
      round: "Final",
      home: T.sanMartin,
      away: T.belgrano,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      pending: true,
      scheduledTime: "17:00"
    }
  ]
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
    {
      id: "unica",
      nombre: "",
      rows: [
        { team: T.mitre, played: 3, goalDiff: 12, points: 3, qualifies: true },
        { team: T.belgrano, played: 3, goalDiff: 4, points: 2, qualifies: true },
        { team: T.guemes, played: 3, goalDiff: -6, points: 1, qualifies: false },
        { team: T.sarmiento, played: 3, goalDiff: -10, points: 0, qualifies: false }
      ]
    }
  ],
  bracket: [
    {
      round: "Final",
      home: T.mitre,
      away: T.belgrano,
      homeScore: null,
      awayScore: null,
      winnerId: null,
      pending: true,
      scheduledTime: "19:00"
    }
  ]
};

const byKey: Record<string, SportData> = {
  "futbol:masculino": futbolMasc,
  "futbol:femenino": futbolFem,
  "voley:masculino": voleyMasc,
  "voley:femenino": voleyFem,
  basquet
};

export function getMockData(sport: Sport, branch: Branch): SportData {
  return byKey[dataKey(sport, branch)] ?? { live: [], zones: [], bracket: [] };
}

export function getMockAllLiveMatches(): LiveMatch[] {
  return Object.values(byKey).flatMap((d) => d.live);
}

export function getMockLiveCount(): number {
  return getMockAllLiveMatches().length;
}
