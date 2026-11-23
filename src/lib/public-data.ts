import { supabase } from "@/lib/supabase";
import type { BracketMatch, Branch, HistorialMatch, HorarioMatch, LiveMatch, Sport, Team, ZoneStandings } from "@/types";
import type { Categoria, EventoPartidoRow, PartidoRow, PodioManual } from "@/lib/db-types";
import { computeZonesForCategoria, estaEnVivo, teamFrom, zonasParaMostrar } from "@/lib/standings";
import { avanzarEnPantalla, cuadroSoloGrupos, proyectarCuadro } from "@/lib/bracket";
import { sinPlayoff } from "@/lib/reglas";
import { getCanchas, getCategorias, getEquipos, getGrupoEquipos, getGrupos } from "@/lib/static-cache";

const ROUND_ORDER = ["Octavos", "Cuartos", "Semifinal", "3er puesto", "Final"];

function ramaDe(sport: Sport, branch: Branch): string {
  if (sport === "voley") return "Mixto";
  return branch === "femenino" ? "Femenino" : "Masculino";
}

function ramaLabelDe(cat: Categoria): string {
  const deporte = cat.deporte === "voley" ? "Vóley" : "Fútbol";
  return cat.rama === "Único" ? deporte : `${deporte} ${cat.rama}`;
}

function branchDe(cat: Categoria): Branch {
  return cat.rama === "Femenino" ? "femenino" : cat.rama === "Mixto" ? "mixto" : "masculino";
}

function scoreDesde(partido: PartidoRow, eventos: EventoPartidoRow[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of eventos) {
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

/** Agrupa los eventos por partido: así cada partido mira solo los suyos en O(1) en vez de re-escanear la lista entera. */
function eventosPorPartido(eventos: EventoPartidoRow[]): Map<string, EventoPartidoRow[]> {
  const mapa = new Map<string, EventoPartidoRow[]>();
  for (const e of eventos) {
    const lista = mapa.get(e.partido_id);
    if (lista) lista.push(e);
    else mapa.set(e.partido_id, [e]);
  }
  return mapa;
}

export interface PublicData {
  zones: ZoneStandings[];
  bracket: BracketMatch[];
  historial: HistorialMatch[];
  /** Categoría mostrada; sirve para ignorar eventos realtime de otras categorías. */
  categoriaId?: string;
  /** Puestos del podio fijados a mano por la organización (categorías sin playoff). */
  podioManual?: PodioManual;
}

const EMPTY: PublicData = { zones: [], bracket: [], historial: [] };

/** Partidos en vivo de TODO el torneo, para el carrusel de la home (no filtrado por pestaña). */
export async function fetchAllLiveMatches(): Promise<LiveMatch[]> {
  if (!supabase) return [];

  const { data: partidosData } = await supabase.from("partidos").select("*").in("estado", ["en_juego", "entretiempo"]);
  const partidos = ((partidosData as PartidoRow[]) ?? []).filter((p) => p.equipo_visitante_id);
  if (partidos.length === 0) return [];

  // Categorías, equipos y canchas salen de la caché; solo los eventos se piden.
  const [categorias, equipos, canchas, { data: eventosData }] = await Promise.all([
    getCategorias(),
    getEquipos(),
    getCanchas(),
    supabase
      .from("eventos_partido")
      .select("*")
      .in(
        "partido_id",
        partidos.map((p) => p.id)
      )
      .eq("anulado", false)
  ]);

  const categoriaMap = new Map(categorias.map((c) => [c.id, c]));
  const equipoMap = new Map(equipos.map((e) => [e.id, teamFrom(e)]));
  const canchaMap = new Map(canchas.map((c) => [c.id, c.nombre]));
  const eventos = (eventosData as EventoPartidoRow[]) ?? [];
  const eventosDe = eventosPorPartido(eventos);

  return partidos
    .filter((p) => equipoMap.has(p.equipo_local_id) && equipoMap.has(p.equipo_visitante_id as string) && categoriaMap.has(p.categoria_id))
    .map((p) => {
      const cat = categoriaMap.get(p.categoria_id) as Categoria;
      // En vóley el veedor va guardando los sets ganados directamente en el resultado.
      const { home: homeScore, away: awayScore } =
        cat.deporte === "voley" ? { home: p.resultado_local ?? 0, away: p.resultado_visitante ?? 0 } : scoreDesde(p, eventosDe.get(p.id) ?? []);
      return {
        id: p.id,
        sport: cat.deporte,
        branch: branchDe(cat),
        ramaLabel: ramaLabelDe(cat),
        home: equipoMap.get(p.equipo_local_id) as Team,
        away: equipoMap.get(p.equipo_visitante_id as string) as Team,
        homeScore,
        awayScore,
        statusLabel:
          p.estado === "entretiempo"
            ? "ENTRETIEMPO"
            : cat.deporte === "voley"
            ? "EN VIVO · SETS"
            : p.penales_local !== null && p.penales_visitante !== null
            ? `PENALES ${p.penales_local}-${p.penales_visitante}`
            : "EN VIVO",
        court: p.cancha_id ? canchaMap.get(p.cancha_id) ?? "" : ""
      };
    });
}

/**
 * Todos los partidos del torneo (todas las categorías) para la grilla de
 * horarios, ordenados por hora y cancha; los que todavía no tienen hora van
 * al final. Los de fútbol en juego llevan el marcador del momento.
 */
export async function fetchHorarios(): Promise<HorarioMatch[]> {
  if (!supabase) return [];
  const [{ data: partidosData }, categorias, equipos, canchas, grupos] = await Promise.all([
    supabase.from("partidos").select("*"),
    getCategorias(),
    getEquipos(),
    getCanchas(),
    getGrupos()
  ]);
  const partidos = (partidosData as PartidoRow[]) ?? [];
  const categoriaMap = new Map(categorias.map((c) => [c.id, c]));
  const equipoMap = new Map(equipos.map((e) => [e.id, teamFrom(e)]));
  const canchaMap = new Map(canchas.map((c) => [c.id, c.nombre]));
  const grupoMap = new Map(grupos.map((g) => [g.id, g.nombre]));

  const futbolEnJuego = partidos.filter((p) => estaEnVivo(p) && categoriaMap.get(p.categoria_id)?.deporte === "futbol");
  let eventos: EventoPartidoRow[] = [];
  if (futbolEnJuego.length > 0) {
    const { data } = await supabase
      .from("eventos_partido")
      .select("*")
      .in(
        "partido_id",
        futbolEnJuego.map((p) => p.id)
      )
      .eq("anulado", false);
    eventos = (data as EventoPartidoRow[]) ?? [];
  }
  const eventosDe = eventosPorPartido(eventos);

  return partidos
    .filter((p) => categoriaMap.has(p.categoria_id) && equipoMap.has(p.equipo_local_id))
    .sort((a, b) => {
      const ta = a.fecha_hora_programada ? new Date(a.fecha_hora_programada).getTime() : Infinity;
      const tb = b.fecha_hora_programada ? new Date(b.fecha_hora_programada).getTime() : Infinity;
      if (ta !== tb) return ta < tb ? -1 : 1;
      // Sin hora: por cancha y, dentro de cada una, en el orden en que se juegan.
      return (
        (canchaMap.get(a.cancha_id ?? "") ?? "").localeCompare(canchaMap.get(b.cancha_id ?? "") ?? "", "es", { numeric: true }) ||
        (a.orden_cancha ?? Infinity) - (b.orden_cancha ?? Infinity)
      );
    })
    .map((p) => {
      const cat = categoriaMap.get(p.categoria_id) as Categoria;
      const enVivo = estaEnVivo(p);
      const marcador = enVivo && cat.deporte === "futbol" ? scoreDesde(p, eventosDe.get(p.id) ?? []) : null;
      const conResultado = enVivo || p.estado === "finalizado";
      return {
        id: p.id,
        sport: cat.deporte,
        branch: branchDe(cat),
        categoriaLabel: ramaLabelDe(cat),
        home: equipoMap.get(p.equipo_local_id) as Team,
        away: p.equipo_visitante_id ? equipoMap.get(p.equipo_visitante_id) ?? null : null,
        fecha: p.fecha_hora_programada,
        court: p.cancha_id ? canchaMap.get(p.cancha_id) ?? null : null,
        orden: p.orden_cancha ?? null,
        roundLabel: p.ronda_eliminatoria ?? (p.grupo_id ? grupoMap.get(p.grupo_id) ?? "Fase de grupos" : sinPlayoff(cat) ? "Todos contra todos" : "Fase de grupos"),
        estado: enVivo ? "en_vivo" : p.estado === "finalizado" || p.estado === "walkover" ? "finalizado" : p.estado === "programado" ? "programado" : "suspendido",
        homeScore: marcador ? marcador.home : conResultado ? p.resultado_local : null,
        awayScore: marcador ? marcador.away : conResultado ? p.resultado_visitante : null,
        penalesHome: p.penales_local,
        penalesAway: p.penales_visitante
      };
    });
}

/** Tablas (por zona si hay grupos cargados) y cruces de una categoría puntual. */
export async function fetchPublicData(sport: Sport, branch: Branch): Promise<PublicData> {
  if (!supabase) return EMPTY;

  const [categorias, todosEquipos, todosGrupos, todosGrupoEquipos, canchas] = await Promise.all([
    getCategorias(),
    getEquipos(),
    getGrupos(),
    getGrupoEquipos(),
    getCanchas()
  ]);
  // Igual que el .maybeSingle() de antes: si no hay una única categoría, no se muestra nada.
  const candidatas = categorias.filter((c) => c.deporte === sport && c.rama === ramaDe(sport, branch));
  if (candidatas.length !== 1) return EMPTY;
  const cat = candidatas[0];

  const gruposCat = todosGrupos.filter((g) => g.categoria_id === cat.id);
  const grupoIds = new Set(gruposCat.map((g) => g.id));
  const zonas = await computeZonesForCategoria(cat, {
    equipos: todosEquipos.filter((e) => e.categoria_id === cat.id),
    grupos: gruposCat,
    grupoEquipos: todosGrupoEquipos.filter((ge) => grupoIds.has(ge.grupo_id))
  }, { enVivo: true });
  const { equipos, partidos, grupos } = zonas;
  // La tabla pública es en vivo: un gol en un partido en juego ya mueve las posiciones.
  const zones = zonasParaMostrar(zonas, cat, true);

  // Marcador del momento de los partidos de playoff en juego (en fútbol sale
  // de los eventos; en vóley el veedor ya guarda los sets en el resultado).
  const playoffEnJuego = partidos.filter((p) => p.ronda_eliminatoria && p.equipo_visitante_id && estaEnVivo(p));
  if (playoffEnJuego.length > 0 && cat.deporte === "futbol") {
    const { data: ev } = await supabase
      .from("eventos_partido")
      .select("*")
      .in(
        "partido_id",
        playoffEnJuego.map((p) => p.id)
      )
      .eq("anulado", false);
    const eventos = (ev as EventoPartidoRow[]) ?? [];
    const eventosDe = eventosPorPartido(eventos);
    for (const p of playoffEnJuego) {
      const { home, away } = scoreDesde(p, eventosDe.get(p.id) ?? []);
      p.resultado_local = home;
      p.resultado_visitante = away;
    }
  }

  // ---- cruces ----
  const canchaMap = new Map(canchas.map((c) => [c.id, c.nombre]));
  const equipoMap = new Map(equipos.map((e) => [e.id, teamFrom(e)]));
  const reales: BracketMatch[] = partidos
    .filter((p) => p.ronda_eliminatoria && equipoMap.has(p.equipo_local_id))
    .sort((a, b) => ROUND_ORDER.indexOf(a.ronda_eliminatoria as string) - ROUND_ORDER.indexOf(b.ronda_eliminatoria as string))
    .map((p) => {
      const rl = p.resultado_local ?? 0;
      const rv = p.resultado_visitante ?? 0;
      const pl = p.penales_local;
      const pv = p.penales_visitante;
      const definidoPorPenales = rl === rv && pl !== null && pv !== null && pl !== pv;
      let winnerId: string | null = null;
      const enVivo = estaEnVivo(p) && Boolean(p.equipo_visitante_id);
      // En juego: el que va adelante "gana" en pantalla (y avanza), hasta el próximo gol.
      if (p.estado === "finalizado" || enVivo) {
        if (rl !== rv) winnerId = rl > rv ? p.equipo_local_id : p.equipo_visitante_id;
        else if (definidoPorPenales) winnerId = (pl as number) > (pv as number) ? p.equipo_local_id : p.equipo_visitante_id;
      }
      return {
        id: p.id,
        round: p.ronda_eliminatoria as string,
        pos: p.llave_pos ?? null,
        home: equipoMap.get(p.equipo_local_id) as Team,
        away: p.equipo_visitante_id ? equipoMap.get(p.equipo_visitante_id) ?? null : null,
        homeScore: p.resultado_local,
        awayScore: p.resultado_visitante,
        penalesHome: pl,
        penalesAway: pv,
        winnerId,
        pending: p.estado !== "finalizado",
        enVivo,
        scheduledTime: p.fecha_hora_programada
          ? new Date(p.fecha_hora_programada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
          : undefined,
        court: p.cancha_id ? canchaMap.get(p.cancha_id) || undefined : undefined
      };
    });

  // Sin cruces armados todavía, el cuadro se proyecta con la tabla del momento.
  // Hasta que arranca el primer partido de grupos (o si los grupos todavía no
  // tienen equipos) el cuadro queda "en blanco": solo los lugares (1ºA vs
  // Mejor 3º…) con "A definir". Desde el primer partido en juego se llena con
  // los equipos y se actualiza en vivo con cada gol.
  const sinAsignar = grupos.length > 0 && zonas.zones.every((z) => z.rows.length === 0);
  const arrancoFaseDeGrupos = partidos.some(
    (p) => !p.ronda_eliminatoria && p.equipo_visitante_id && (p.estado === "finalizado" || estaEnVivo(p))
  );
  const enBlanco = sinAsignar || !arrancoFaseDeGrupos;
  const tamanios = sinAsignar
    ? grupos
    : zonas.zones.filter((z) => z.rows.length > 0).map((z) => ({ nombre: z.nombre, cantidad: z.rows.length }));
  const proyeccion = enBlanco ? cuadroSoloGrupos(grupos.length > 0 ? tamanios : [], equipos.length) : proyectarCuadro(zones);
  // Sin cuadro de playoff (liguilla femenino o vóley): no hay cruces, gana el que más puntos suma.
  const bracket = sinPlayoff(cat) ? [] : avanzarEnPantalla(reales.length > 0 ? reales : proyeccion);

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

  return { zones, bracket, historial, categoriaId: cat.id, podioManual: cat.reglas?.podio };
}
