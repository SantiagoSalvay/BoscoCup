import { supabase } from "@/lib/supabase";
import type { BracketMatch, Branch, HistorialMatch, LiveMatch, Sport, Team, ZoneStandings } from "@/types";
import type { CanchaRow, Categoria, EquipoRow, EventoPartidoRow, PartidoRow } from "@/lib/db-types";
import { computeZonesForCategoria, teamFrom } from "@/lib/standings";

const ROUND_ORDER = ["Octavos", "Cuartos", "Semifinal", "3er puesto", "Final"];

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

export interface PublicData {
  zones: ZoneStandings[];
  bracket: BracketMatch[];
  historial: HistorialMatch[];
}

const EMPTY: PublicData = { zones: [], bracket: [], historial: [] };

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

  const { zones, equipos, partidos, grupos } = await computeZonesForCategoria(cat);

  // ---- cruces ----
  const equipoMap = new Map(equipos.map((e) => [e.id, teamFrom(e)]));
  const bracket: BracketMatch[] = partidos
    .filter((p) => p.ronda_eliminatoria && equipoMap.has(p.equipo_local_id))
    .sort((a, b) => ROUND_ORDER.indexOf(a.ronda_eliminatoria as string) - ROUND_ORDER.indexOf(b.ronda_eliminatoria as string))
    .map((p) => {
      const rl = p.resultado_local ?? 0;
      const rv = p.resultado_visitante ?? 0;
      const pl = p.penales_local;
      const pv = p.penales_visitante;
      const definidoPorPenales = rl === rv && pl !== null && pv !== null && pl !== pv;
      let winnerId: string | null = null;
      if (p.estado === "finalizado") {
        if (rl !== rv) winnerId = rl > rv ? p.equipo_local_id : p.equipo_visitante_id;
        else if (definidoPorPenales) winnerId = (pl as number) > (pv as number) ? p.equipo_local_id : p.equipo_visitante_id;
      }
      return {
        round: p.ronda_eliminatoria as string,
        home: equipoMap.get(p.equipo_local_id) as Team,
        away: p.equipo_visitante_id ? equipoMap.get(p.equipo_visitante_id) ?? null : null,
        homeScore: p.resultado_local,
        awayScore: p.resultado_visitante,
        penalesHome: pl,
        penalesAway: pv,
        winnerId,
        pending: p.estado !== "finalizado",
        scheduledTime: p.fecha_hora_programada
          ? new Date(p.fecha_hora_programada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
          : undefined
      };
    });

  // ---- historial de resultados ----
  const grupoNombrePorId = new Map(grupos.map((g) => [g.id, g.nombre]));
  const historial: HistorialMatch[] = partidos
    .filter((p) => p.estado === "finalizado" && p.equipo_visitante_id && equipoMap.has(p.equipo_local_id) && equipoMap.has(p.equipo_visitante_id))
    .sort((a, b) => (b.fecha_hora_programada ?? "").localeCompare(a.fecha_hora_programada ?? ""))
    .map((p) => ({
      id: p.id,
      home: equipoMap.get(p.equipo_local_id) as Team,
      away: equipoMap.get(p.equipo_visitante_id as string) as Team,
      homeScore: p.resultado_local ?? 0,
      awayScore: p.resultado_visitante ?? 0,
      penalesHome: p.penales_local,
      penalesAway: p.penales_visitante,
      roundLabel: p.ronda_eliminatoria ?? (p.grupo_id ? grupoNombrePorId.get(p.grupo_id) ?? "Fase de grupos" : "Fase de grupos"),
      date: p.fecha_hora_programada
        ? new Date(p.fecha_hora_programada).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
        : ""
    }));

  return { zones, bracket, historial };
}
