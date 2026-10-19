import { supabase } from "@/lib/supabase";
import type { BracketMatch, Branch, LiveMatch, Sport, StandingRow, Team, ZoneStandings } from "@/types";
import type { CanchaRow, Categoria, EquipoRow, EventoPartidoRow, PartidoRow } from "@/lib/db-types";

const ROUND_ORDER = ["Octavos", "Cuartos", "Semifinal", "3er puesto", "Final"];

function teamFrom(row: EquipoRow): Team {
  return { id: row.id, name: row.nombre, shieldColor: row.color_primario };
}

function ramaDe(sport: Sport, branch: Branch): string {
  if (sport === "basquet") return "Único";
  return branch === "masculino" ? "Masculino" : "Femenino";
}

function ramaLabelDe(cat: Categoria): string {
  const deporte = cat.deporte[0].toUpperCase() + cat.deporte.slice(1);
  return cat.rama === "Único" ? deporte : `${deporte} ${cat.rama}`;
}

function scoreDesde(partido: PartidoRow, eventos: EventoPartidoRow[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of eventos) {
    if (e.partido_id !== partido.id) continue;
    if (e.tipo === "gol" || e.tipo === "penal_convertido") {
      if (e.equipo_id === partido.equipo_local_id) home++;
      else if (e.equipo_id === partido.equipo_visitante_id) away++;
    } else if (e.tipo === "gol_en_contra") {
      if (e.equipo_id === partido.equipo_local_id) away++;
      else if (e.equipo_id === partido.equipo_visitante_id) home++;
    }
  }
  return { home, away };
}

function computeStandings(equipos: EquipoRow[], partidosFinalizados: PartidoRow[], cat: Categoria): StandingRow[] {
  interface Agg {
    pj: number;
    pg: number;
    pe: number;
    pp: number;
    gf: number;
    gc: number;
  }
  const agg = new Map<string, Agg>();
  equipos.forEach((e) => agg.set(e.id, { pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0 }));

  for (const p of partidosFinalizados) {
    if (!p.equipo_visitante_id) continue;
    const local = agg.get(p.equipo_local_id);
    const visitante = agg.get(p.equipo_visitante_id);
    if (!local || !visitante) continue;
    const rl = p.resultado_local ?? 0;
    const rv = p.resultado_visitante ?? 0;
    local.pj++;
    visitante.pj++;
    local.gf += rl;
    local.gc += rv;
    visitante.gf += rv;
    visitante.gc += rl;
    if (rl > rv) {
      local.pg++;
      visitante.pp++;
    } else if (rl < rv) {
      visitante.pg++;
      local.pp++;
    } else {
      local.pe++;
      visitante.pe++;
    }
  }

  const rows = equipos
    .map((e) => {
      const a = agg.get(e.id) as Agg;
      const points = a.pg * cat.puntos_victoria + a.pe * cat.puntos_empate + a.pp * cat.puntos_derrota;
      return { team: teamFrom(e), played: a.pj, goalDiff: a.gf - a.gc, points, qualifies: false };
    })
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
  rows.forEach((row, i) => {
    row.qualifies = i < cat.cantidad_clasifican_por_grupo;
  });
  return rows;
}

export interface PublicData {
  zones: ZoneStandings[];
  bracket: BracketMatch[];
}

const EMPTY: PublicData = { zones: [], bracket: [] };

export async function fetchLiveCount(): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase.from("partidos").select("id").in("estado", ["en_juego", "entretiempo"]);
  return data?.length ?? 0;
}

/** Partidos en vivo de TODO el torneo, para el carrusel de la home (no filtrado por pestaña). */
export async function fetchAllLiveMatches(): Promise<LiveMatch[]> {
  if (!supabase) return [];

  const { data: partidosData } = await supabase.from("partidos").select("*").in("estado", ["en_juego", "entretiempo"]);
  const partidos = ((partidosData as PartidoRow[]) ?? []).filter((p) => p.equipo_visitante_id);
  if (partidos.length === 0) return [];

  const equipoIds = Array.from(new Set(partidos.flatMap((p) => [p.equipo_local_id, p.equipo_visitante_id as string])));
  const canchaIds = Array.from(new Set(partidos.map((p) => p.cancha_id).filter((id): id is string => Boolean(id))));

  const [{ data: categoriasData }, { data: equiposData }, { data: canchasData }, { data: eventosData }] = await Promise.all([
    supabase.from("categorias").select("*"),
    supabase.from("equipos").select("*").in("id", equipoIds),
    canchaIds.length ? supabase.from("canchas").select("*").in("id", canchaIds) : Promise.resolve({ data: [] as CanchaRow[] }),
    supabase
      .from("eventos_partido")
      .select("*")
      .in(
        "partido_id",
        partidos.map((p) => p.id)
      )
      .eq("anulado", false)
  ]);

  const categoriaMap = new Map(((categoriasData as Categoria[]) ?? []).map((c) => [c.id, c]));
  const equipoMap = new Map(((equiposData as EquipoRow[]) ?? []).map((e) => [e.id, teamFrom(e)]));
  const canchaMap = new Map(((canchasData as CanchaRow[]) ?? []).map((c) => [c.id, c.nombre]));
  const eventos = (eventosData as EventoPartidoRow[]) ?? [];

  return partidos
    .filter((p) => equipoMap.has(p.equipo_local_id) && equipoMap.has(p.equipo_visitante_id as string) && categoriaMap.has(p.categoria_id))
    .map((p) => {
      const cat = categoriaMap.get(p.categoria_id) as Categoria;
      const { home: homeScore, away: awayScore } = scoreDesde(p, eventos);
      return {
        id: p.id,
        sport: cat.deporte,
        branch: cat.rama === "Femenino" ? "femenino" : "masculino",
        ramaLabel: ramaLabelDe(cat),
        home: equipoMap.get(p.equipo_local_id) as Team,
        away: equipoMap.get(p.equipo_visitante_id as string) as Team,
        homeScore,
        awayScore,
        statusLabel: p.estado === "entretiempo" ? "ENTRETIEMPO" : "EN VIVO",
        court: p.cancha_id ? canchaMap.get(p.cancha_id) ?? "" : ""
      };
    });
}

/** Tablas (por zona si hay grupos cargados) y cruces de una categoría puntual. */
export async function fetchPublicData(sport: Sport, branch: Branch): Promise<PublicData> {
  if (!supabase) return EMPTY;

  const { data: categoria } = await supabase
    .from("categorias")
    .select("*")
    .eq("deporte", sport)
    .eq("rama", ramaDe(sport, branch))
    .maybeSingle();
  if (!categoria) return EMPTY;
  const cat = categoria as Categoria;

  const [{ data: equiposData }, { data: partidosData }, { data: gruposData }] = await Promise.all([
    supabase.from("equipos").select("*").eq("categoria_id", cat.id),
    supabase.from("partidos").select("*").eq("categoria_id", cat.id),
    supabase.from("grupos").select("*").eq("categoria_id", cat.id)
  ]);

  const equipos = (equiposData as EquipoRow[]) ?? [];
  const partidos = (partidosData as PartidoRow[]) ?? [];
  const grupos = gruposData ?? [];
  const finalizados = partidos.filter((p) => p.estado === "finalizado");

  let zones: ZoneStandings[];
  if (grupos.length > 0) {
    const { data: geData } = await supabase
      .from("grupo_equipos")
      .select("*")
      .in(
        "grupo_id",
        grupos.map((g) => g.id)
      );
    const ge = (geData as { grupo_id: string; equipo_id: string }[]) ?? [];
    zones = grupos.map((g) => {
      const equipoIds = new Set(ge.filter((x) => x.grupo_id === g.id).map((x) => x.equipo_id));
      const equiposZona = equipos.filter((e) => equipoIds.has(e.id));
      const partidosZona = finalizados.filter((p) => p.grupo_id === g.id);
      return { id: g.id, nombre: g.nombre, rows: computeStandings(equiposZona, partidosZona, cat) };
    });
  } else {
    zones = [{ id: "general", nombre: "", rows: computeStandings(equipos, finalizados, cat) }];
  }

  // ---- cruces ----
  const equipoMap = new Map(equipos.map((e) => [e.id, teamFrom(e)]));
  const bracket: BracketMatch[] = partidos
    .filter((p) => p.ronda_eliminatoria && equipoMap.has(p.equipo_local_id))
    .sort((a, b) => ROUND_ORDER.indexOf(a.ronda_eliminatoria as string) - ROUND_ORDER.indexOf(b.ronda_eliminatoria as string))
    .map((p) => ({
      round: p.ronda_eliminatoria as string,
      home: equipoMap.get(p.equipo_local_id) as Team,
      away: p.equipo_visitante_id ? equipoMap.get(p.equipo_visitante_id) ?? null : null,
      homeScore: p.resultado_local,
      awayScore: p.resultado_visitante,
      winnerId:
        p.estado === "finalizado"
          ? (p.resultado_local ?? 0) > (p.resultado_visitante ?? 0)
            ? p.equipo_local_id
            : p.equipo_visitante_id
          : null,
      pending: p.estado !== "finalizado",
      scheduledTime: p.fecha_hora_programada
        ? new Date(p.fecha_hora_programada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
        : undefined
    }));

  return { zones, bracket };
}
