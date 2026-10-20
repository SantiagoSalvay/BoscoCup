import { supabase } from "@/lib/supabase";
import type { CanchaRow, Categoria, EquipoRow, EventoPartidoRow, JugadorRow, PartidoRow } from "@/lib/db-types";
import { computeZonesForCategoria, teamFrom } from "@/lib/standings";
import type { Sport, StandingRow, Team } from "@/types";

export type ResultadoLetra = "G" | "E" | "P";

export interface TeamPlayer {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  goals: number;
  amarillas: number;
  rojas: number;
}

export interface TeamMatch {
  id: string;
  rival: Team;
  isHome: boolean;
  goalsFor: number | null;
  goalsAgainst: number | null;
  penalesFor: number | null;
  penalesAgainst: number | null;
  status: "finalizado" | "en_vivo" | "programado";
  result: ResultadoLetra | null;
  roundLabel: string;
  when: string;
  court: string;
}

export interface TeamDetail {
  team: Team;
  sport: Sport;
  categoriaLabel: string;
  zoneName: string;
  zoneSize: number;
  standing: StandingRow | null;
  players: TeamPlayer[];
  matches: TeamMatch[];
  /** Últimos resultados (más reciente primero), para la racha. */
  form: ResultadoLetra[];
}

function categoriaLabel(cat: Categoria): string {
  const deporte = { futbol: "Fútbol", voley: "Vóley", basquet: "Básquet" }[cat.deporte];
  return cat.rama === "Único" ? deporte : `${deporte} ${cat.rama}`;
}

function resultadoDe(gf: number, ga: number, pf: number | null, pa: number | null): ResultadoLetra {
  if (gf !== ga) return gf > ga ? "G" : "P";
  if (pf !== null && pa !== null && pf !== pa) return pf > pa ? "G" : "P";
  return "E";
}

function horario(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} · ${d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

/** Todo lo que muestra la ficha de un equipo: posición, números, plantel y partidos. */
export async function fetchTeamDetail(teamId: string): Promise<TeamDetail | null> {
  if (!supabase) return null;

  const { data: equipoData } = await supabase.from("equipos").select("*").eq("id", teamId).maybeSingle();
  const equipo = equipoData as EquipoRow | null;
  if (!equipo) return null;

  const { data: catData } = await supabase.from("categorias").select("*").eq("id", equipo.categoria_id).maybeSingle();
  const cat = catData as Categoria | null;
  if (!cat) return null;

  const [{ zones, equipos, partidos, grupos }, { data: jugadoresData }] = await Promise.all([
    computeZonesForCategoria(cat),
    supabase.from("jugadores").select("*").eq("equipo_id", teamId).order("numero")
  ]);
  const jugadores = (jugadoresData as JugadorRow[]) ?? [];

  const propios = partidos.filter(
    (p) => p.equipo_visitante_id && (p.equipo_local_id === teamId || p.equipo_visitante_id === teamId)
  );
  const canchaIds = Array.from(new Set(propios.map((p) => p.cancha_id).filter((id): id is string => Boolean(id))));

  const [{ data: eventosData }, { data: canchasData }] = await Promise.all([
    propios.length
      ? supabase
          .from("eventos_partido")
          .select("*")
          .in(
            "partido_id",
            propios.map((p) => p.id)
          )
          .eq("anulado", false)
      : Promise.resolve({ data: [] as EventoPartidoRow[] }),
    canchaIds.length ? supabase.from("canchas").select("*").in("id", canchaIds) : Promise.resolve({ data: [] as CanchaRow[] })
  ]);
  const eventos = (eventosData as EventoPartidoRow[]) ?? [];
  const canchaNombre = new Map(((canchasData as CanchaRow[]) ?? []).map((c) => [c.id, c.nombre]));

  // ---- plantel con sus números ----
  const porJugador = new Map<string, { goals: number; amarillas: number; rojas: number }>();
  for (const e of eventos) {
    if (!e.jugador_id) continue;
    const cur = porJugador.get(e.jugador_id) ?? { goals: 0, amarillas: 0, rojas: 0 };
    if (e.tipo === "gol" || e.tipo === "penal_convertido") cur.goals++;
    else if (e.tipo === "tarjeta_amarilla") cur.amarillas++;
    else if (e.tipo === "tarjeta_roja") cur.rojas++;
    else if (e.tipo === "doble_amarilla") {
      cur.amarillas++;
      cur.rojas++;
    }
    porJugador.set(e.jugador_id, cur);
  }
  const players: TeamPlayer[] = jugadores
    .map((j) => ({
      id: j.id,
      name: j.nombre,
      number: j.numero,
      position: j.posicion,
      ...(porJugador.get(j.id) ?? { goals: 0, amarillas: 0, rojas: 0 })
    }))
    .sort((a, b) => b.goals - a.goals || (a.number ?? 999) - (b.number ?? 999));

  // ---- partidos ----
  const equipoMap = new Map(equipos.map((e) => [e.id, teamFrom(e)]));
  const grupoNombre = new Map(grupos.map((g) => [g.id, g.nombre]));
  const marcadorEnVivo = (p: PartidoRow) => {
    let home = 0;
    let away = 0;
    for (const e of eventos) {
      if (e.partido_id !== p.id) continue;
      const esLocal = e.equipo_id === p.equipo_local_id;
      if (e.tipo === "gol" || e.tipo === "penal_convertido") esLocal ? home++ : away++;
      else if (e.tipo === "gol_en_contra") esLocal ? away++ : home++;
    }
    return { home, away };
  };

  const matches: TeamMatch[] = propios
    .filter((p) => equipoMap.has(p.equipo_local_id) && equipoMap.has(p.equipo_visitante_id as string))
    .sort((a, b) => (a.fecha_hora_programada ?? a.created_at ?? "").localeCompare(b.fecha_hora_programada ?? b.created_at ?? ""))
    .map((p) => {
      const isHome = p.equipo_local_id === teamId;
      const rivalId = (isHome ? p.equipo_visitante_id : p.equipo_local_id) as string;
      const enVivo = p.estado === "en_juego" || p.estado === "entretiempo";
      const finalizado = p.estado === "finalizado";
      let home: number | null = null;
      let away: number | null = null;
      if (finalizado) {
        home = p.resultado_local ?? 0;
        away = p.resultado_visitante ?? 0;
      } else if (enVivo) {
        ({ home, away } = marcadorEnVivo(p));
      }
      const gf = isHome ? home : away;
      const ga = isHome ? away : home;
      const pf = isHome ? p.penales_local : p.penales_visitante;
      const pa = isHome ? p.penales_visitante : p.penales_local;
      return {
        id: p.id,
        rival: equipoMap.get(rivalId) as Team,
        isHome,
        goalsFor: gf,
        goalsAgainst: ga,
        penalesFor: pf,
        penalesAgainst: pa,
        status: finalizado ? "finalizado" : enVivo ? "en_vivo" : "programado",
        result: finalizado ? resultadoDe(gf as number, ga as number, pf, pa) : null,
        roundLabel: p.ronda_eliminatoria ?? (p.grupo_id ? grupoNombre.get(p.grupo_id) ?? "Fase de grupos" : "Fase de grupos"),
        when: horario(p.fecha_hora_programada),
        court: p.cancha_id ? canchaNombre.get(p.cancha_id) ?? "" : ""
      };
    });

  const zone = zones.find((z) => z.rows.some((r) => r.team.id === teamId));
  const form = matches
    .filter((m) => m.result)
    .map((m) => m.result as ResultadoLetra)
    .reverse()
    .slice(0, 5);

  return {
    team: teamFrom(equipo),
    sport: cat.deporte,
    categoriaLabel: categoriaLabel(cat),
    zoneName: zone?.nombre ?? "",
    zoneSize: zone?.rows.length ?? 0,
    standing: zone?.rows.find((r) => r.team.id === teamId) ?? null,
    players,
    matches,
    form
  };
}
