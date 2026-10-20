import { supabase } from "@/lib/supabase";
import type { StandingRow, Team, ZoneStandings } from "@/types";
import type { Categoria, EquipoRow, GrupoRow, PartidoRow } from "@/lib/db-types";

export function teamFrom(row: EquipoRow): Team {
  return { id: row.id, name: row.nombre, shieldColor: row.color_primario };
}

type Tarjetas = { amarillas: number; rojas: number };

/**
 * Posiciones de un conjunto de equipos a partir de sus partidos finalizados.
 * Orden de desempate (de mayor a menor prioridad): puntos, diferencia de gol,
 * tarjetas amarillas (menos es mejor), tarjetas rojas (menos es mejor). Los
 * partidos de fase eliminatoria (`ronda_eliminatoria` seteado) nunca entran
 * acá — ver `computeZonesForCategoria`.
 */
export function computeStandings(
  equipos: EquipoRow[],
  partidosFinalizados: PartidoRow[],
  cat: Categoria,
  tarjetas: Map<string, Tarjetas> = new Map(),
  completa = false
): StandingRow[] {
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

  const rows: StandingRow[] = equipos
    .map((e) => {
      const a = agg.get(e.id) as Agg;
      const t = tarjetas.get(e.id) ?? { amarillas: 0, rojas: 0 };
      const points = a.pg * cat.puntos_victoria + a.pe * cat.puntos_empate + a.pp * cat.puntos_derrota;
      return {
        team: teamFrom(e),
        position: 0,
        played: a.pj,
        won: a.pg,
        drawn: a.pe,
        lost: a.pp,
        goalsFor: a.gf,
        goalsAgainst: a.gc,
        goalDiff: a.gf - a.gc,
        points,
        amarillas: t.amarillas,
        rojas: t.rojas,
        qualifies: false,
        empatado: false
      };
    })
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || a.amarillas - b.amarillas || a.rojas - b.rojas);

  const hayJugados = rows.some((r) => r.played > 0);
  rows.forEach((row, i) => {
    row.position = i + 1;
    row.qualifies = hayJugados && i < cat.cantidad_clasifican_por_grupo;
  });

  // El aviso de desempate solo tiene sentido con la zona terminada: antes de
  // eso (o con todos en cero) "empatados" es simplemente "todavía no jugaron".
  if (!completa) return rows;
  for (let i = 0; i < rows.length; i++) {
    if (estanEmpatados(rows[i], rows[i - 1]) || estanEmpatados(rows[i], rows[i + 1])) {
      rows[i].empatado = true;
    }
  }

  return rows;
}

/** Mismos puntos, DG, amarillas y rojas — no hay forma de ordenarlos sin un partido de desempate. */
export function estanEmpatados(a?: StandingRow, b?: StandingRow): boolean {
  if (!a || !b) return false;
  return a.points === b.points && a.goalDiff === b.goalDiff && a.amarillas === b.amarillas && a.rojas === b.rojas;
}

/**
 * La fase de grupos de una zona terminó cuando no queda ningún partido sin
 * finalizar Y todos los equipos ya se enfrentaron entre sí. Lo segundo evita
 * declarar "terminada" una zona solo porque todavía no se programaron las
 * fechas que faltan.
 */
function zonaCompleta(equipoIds: string[], partidosZona: PartidoRow[]): boolean {
  if (equipoIds.length < 2 || partidosZona.length === 0) return false;
  if (partidosZona.some((p) => p.estado !== "finalizado")) return false;
  const jugados = new Set(
    partidosZona.map((p) => [p.equipo_local_id, p.equipo_visitante_id as string].sort().join("|"))
  );
  for (let i = 0; i < equipoIds.length; i++) {
    for (let j = i + 1; j < equipoIds.length; j++) {
      if (!jugados.has([equipoIds[i], equipoIds[j]].sort().join("|"))) return false;
    }
  }
  return true;
}

export interface ZonasCategoria {
  zones: ZoneStandings[];
  equipos: EquipoRow[];
  partidos: PartidoRow[];
  grupos: GrupoRow[];
}

async function cardCountsFor(partidoIds: string[]): Promise<Map<string, Tarjetas>> {
  const map = new Map<string, Tarjetas>();
  if (!supabase || partidoIds.length === 0) return map;

  const { data } = await supabase
    .from("eventos_partido")
    .select("equipo_id, tipo")
    .in("partido_id", partidoIds)
    .eq("anulado", false)
    .in("tipo", ["tarjeta_amarilla", "tarjeta_roja", "doble_amarilla"]);

  for (const row of (data as { equipo_id: string | null; tipo: string }[]) ?? []) {
    if (!row.equipo_id) continue;
    const cur = map.get(row.equipo_id) ?? { amarillas: 0, rojas: 0 };
    if (row.tipo === "tarjeta_amarilla") cur.amarillas++;
    else if (row.tipo === "tarjeta_roja") cur.rojas++;
    else if (row.tipo === "doble_amarilla") {
      // la segunda amarilla implica expulsión: cuenta como amarilla y como roja.
      cur.amarillas++;
      cur.rojas++;
    }
    map.set(row.equipo_id, cur);
  }
  return map;
}

/**
 * Tabla (por zona si hay grupos cargados) de una categoría. Los partidos de
 * fase eliminatoria se excluyen siempre: una vez que hay cruces generados,
 * esos resultados no deben sumar de nuevo en la tabla de grupos.
 */
export async function computeZonesForCategoria(cat: Categoria): Promise<ZonasCategoria> {
  if (!supabase) return { zones: [], equipos: [], partidos: [], grupos: [] };

  const [{ data: equiposData }, { data: partidosData }, { data: gruposData }] = await Promise.all([
    supabase.from("equipos").select("*").eq("categoria_id", cat.id),
    supabase.from("partidos").select("*").eq("categoria_id", cat.id),
    supabase.from("grupos").select("*").eq("categoria_id", cat.id)
  ]);

  const equipos = (equiposData as EquipoRow[]) ?? [];
  const partidos = (partidosData as PartidoRow[]) ?? [];
  const grupos = (gruposData as GrupoRow[]) ?? [];
  const partidosDeGrupo = partidos.filter((p) => !p.ronda_eliminatoria && p.equipo_visitante_id);
  const finalizadosDeGrupo = partidosDeGrupo.filter((p) => p.estado === "finalizado");
  const tarjetas = await cardCountsFor(finalizadosDeGrupo.map((p) => p.id));

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
    zones = [...grupos]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((g) => {
        const equipoIds = new Set(ge.filter((x) => x.grupo_id === g.id).map((x) => x.equipo_id));
        const equiposZona = equipos.filter((e) => equipoIds.has(e.id));
        // Partido de la zona: el que tiene el grupo cargado, o (si se programó
        // sin grupo) el que enfrenta a dos equipos de esta misma zona.
        const deLaZona = (p: PartidoRow) =>
          p.grupo_id === g.id ||
          (!p.grupo_id && equipoIds.has(p.equipo_local_id) && !!p.equipo_visitante_id && equipoIds.has(p.equipo_visitante_id));
        const partidosZona = partidosDeGrupo.filter(deLaZona);
        const completa = zonaCompleta(equiposZona.map((e) => e.id), partidosZona);
        return {
          id: g.id,
          nombre: g.nombre,
          completa,
          rows: computeStandings(equiposZona, partidosZona.filter((p) => p.estado === "finalizado"), cat, tarjetas, completa)
        };
      });
  } else {
    const completa = zonaCompleta(equipos.map((e) => e.id), partidosDeGrupo);
    zones = [{ id: "general", nombre: "", completa, rows: computeStandings(equipos, finalizadosDeGrupo, cat, tarjetas, completa) }];
  }

  return { zones, equipos, partidos, grupos };
}
