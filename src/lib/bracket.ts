import { supabase } from "@/lib/supabase";
import { computeZonesForCategoria, estanEmpatados } from "@/lib/standings";
import type { Categoria, PartidoRow } from "@/lib/db-types";

const ROUND_ORDER = ["Octavos", "Cuartos", "Semifinal", "3er puesto", "Final"];

function rondaParaCantidad(n: number): string | null {
  if (n === 16) return "Octavos";
  if (n === 8) return "Cuartos";
  if (n === 4) return "Semifinal";
  if (n === 2) return "Final";
  return null;
}

/** true si el partido tiene un ganador claro (distinto en el resultado, o definido por penales). */
function estaDefinido(p: PartidoRow): boolean {
  const rl = p.resultado_local ?? 0;
  const rv = p.resultado_visitante ?? 0;
  if (rl !== rv) return true;
  return p.penales_local !== null && p.penales_visitante !== null && p.penales_local !== p.penales_visitante;
}

function ganadorDe(p: PartidoRow): string {
  const rl = p.resultado_local ?? 0;
  const rv = p.resultado_visitante ?? 0;
  if (rl !== rv) return rl > rv ? p.equipo_local_id : (p.equipo_visitante_id as string);
  return (p.penales_local ?? 0) > (p.penales_visitante ?? 0) ? p.equipo_local_id : (p.equipo_visitante_id as string);
}

function perdedorDe(p: PartidoRow): string {
  const rl = p.resultado_local ?? 0;
  const rv = p.resultado_visitante ?? 0;
  if (rl !== rv) return rl > rv ? (p.equipo_visitante_id as string) : p.equipo_local_id;
  return (p.penales_local ?? 0) > (p.penales_visitante ?? 0) ? (p.equipo_visitante_id as string) : p.equipo_local_id;
}

export interface GenerarCrucesResultado {
  ok: boolean;
  mensaje: string;
}

/**
 * Genera automáticamente la siguiente fase eliminatoria de una categoría:
 * - Si todavía no hay ningún cruce, arma la primera ronda a partir de los
 *   clasificados de la tabla (por zona, o los primeros N de la tabla general
 *   si no hay grupos cargados).
 * - Si ya hay una ronda eliminatoria cargada y está completa, arma la
 *   siguiente (Semifinal -> Final + 3er puesto incluido).
 * Nunca pisa partidos existentes; solo inserta los de la ronda nueva.
 */
export async function generarCruces(categoriaId: string, clasificanSinGrupos?: number): Promise<GenerarCrucesResultado> {
  if (!supabase) return { ok: false, mensaje: "Supabase no está configurado." };

  const { data: catData } = await supabase.from("categorias").select("*").eq("id", categoriaId).maybeSingle();
  const cat = catData as Categoria | null;
  if (!cat) return { ok: false, mensaje: "Categoría no encontrada." };

  const { data: partidosData } = await supabase.from("partidos").select("*").eq("categoria_id", categoriaId);
  const partidos = (partidosData as PartidoRow[]) ?? [];
  const elim = partidos.filter((p) => p.ronda_eliminatoria);

  if (elim.length === 0) return generarPrimeraRonda(cat, partidos, clasificanSinGrupos);
  return generarSiguienteRonda(categoriaId, elim);
}

async function generarPrimeraRonda(cat: Categoria, partidos: PartidoRow[], clasificanSinGrupos?: number): Promise<GenerarCrucesResultado> {
  if (!supabase) return { ok: false, mensaje: "Supabase no está configurado." };

  const partidosDeGrupo = partidos.filter((p) => !p.ronda_eliminatoria);
  const pendientes = partidosDeGrupo.filter((p) => p.equipo_visitante_id && p.estado !== "finalizado");
  if (pendientes.length > 0) {
    return { ok: false, mensaje: `Faltan ${pendientes.length} partido(s) de fase de grupos por finalizar.` };
  }

  const { zones } = await computeZonesForCategoria(cat);
  if (zones.length === 0 || zones.every((z) => z.rows.length === 0)) {
    return { ok: false, mensaje: "Todavía no hay partidos jugados para armar una tabla." };
  }

  let qualifiers: { teamId: string; rank: number; zoneIndex: number }[] = [];
  if (zones.length > 1) {
    for (const zone of zones) {
      const cutoff = cat.cantidad_clasifican_por_grupo;
      if (estanEmpatados(zone.rows[cutoff - 1], zone.rows[cutoff])) {
        return {
          ok: false,
          mensaje: `En la zona "${zone.nombre}" hay un empate total entre ${zone.rows[cutoff - 1].team.name} y ${zone.rows[cutoff].team.name} (mismos puntos, DG, amarillas y rojas) — hace falta un partido de desempate antes de generar los cruces.`
        };
      }
    }
    zones.forEach((zone, zi) => {
      zone.rows.slice(0, cat.cantidad_clasifican_por_grupo).forEach((row, rank) => {
        qualifiers.push({ teamId: row.team.id, rank, zoneIndex: zi });
      });
    });
    qualifiers.sort((a, b) => a.rank - b.rank || a.zoneIndex - b.zoneIndex);
  } else {
    const k = clasificanSinGrupos ?? cat.cantidad_clasifican_por_grupo;
    if (estanEmpatados(zones[0].rows[k - 1], zones[0].rows[k])) {
      return {
        ok: false,
        mensaje: `Hay un empate total entre ${zones[0].rows[k - 1].team.name} y ${zones[0].rows[k].team.name} (mismos puntos, DG, amarillas y rojas) — hace falta un partido de desempate antes de generar los cruces.`
      };
    }
    qualifiers = zones[0].rows.slice(0, k).map((row, i) => ({ teamId: row.team.id, rank: i, zoneIndex: 0 }));
  }

  const n = qualifiers.length;
  const ronda = rondaParaCantidad(n);
  if (!ronda) {
    return {
      ok: false,
      mensaje: `${n} equipo(s) clasificado(s) no forman un cuadro válido (tiene que ser 2, 4, 8 o 16).`
    };
  }

  const nuevos = [];
  for (let i = 0; i < n / 2; i++) {
    nuevos.push({
      categoria_id: cat.id,
      ronda_eliminatoria: ronda,
      equipo_local_id: qualifiers[i].teamId,
      equipo_visitante_id: qualifiers[n - 1 - i].teamId,
      estado: "programado" as const
    });
  }

  const { error } = await supabase.from("partidos").insert(nuevos);
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, mensaje: `${nuevos.length} partido(s) de ${ronda} generados.` };
}

async function generarSiguienteRonda(categoriaId: string, elim: PartidoRow[]): Promise<GenerarCrucesResultado> {
  if (!supabase) return { ok: false, mensaje: "Supabase no está configurado." };

  const rondaActualIdx = Math.max(...elim.map((p) => ROUND_ORDER.indexOf(p.ronda_eliminatoria as string)));
  const rondaActual = ROUND_ORDER[rondaActualIdx];
  if (rondaActual === "Final" || rondaActual === "3er puesto") {
    return { ok: false, mensaje: "El cuadro de eliminación ya está completo." };
  }

  const partidosRonda = elim
    .filter((p) => p.ronda_eliminatoria === rondaActual)
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));

  const pendientes = partidosRonda.filter((p) => p.estado !== "finalizado");
  if (pendientes.length > 0) {
    return { ok: false, mensaje: `Faltan ${pendientes.length} partido(s) de ${rondaActual} por finalizar.` };
  }

  const empatados = partidosRonda.filter((p) => !estaDefinido(p));
  if (empatados.length > 0) {
    return {
      ok: false,
      mensaje: `Hay ${empatados.length} partido(s) de ${rondaActual} empatados — en eliminatoria hace falta definir un ganador (penales) antes de poder armar la siguiente ronda.`
    };
  }

  if (rondaActual === "Semifinal") {
    if (partidosRonda.length !== 2) {
      return { ok: false, mensaje: "La Semifinal debe tener exactamente 2 partidos para poder armar Final y 3er puesto." };
    }
    const ganadores = partidosRonda.map(ganadorDe);
    const perdedores = partidosRonda.map(perdedorDe);
    const nuevos = [
      {
        categoria_id: categoriaId,
        ronda_eliminatoria: "Final",
        equipo_local_id: ganadores[0],
        equipo_visitante_id: ganadores[1],
        estado: "programado" as const
      },
      {
        categoria_id: categoriaId,
        ronda_eliminatoria: "3er puesto",
        equipo_local_id: perdedores[0],
        equipo_visitante_id: perdedores[1],
        estado: "programado" as const
      }
    ];
    const { error } = await supabase.from("partidos").insert(nuevos);
    if (error) return { ok: false, mensaje: error.message };
    return { ok: true, mensaje: "Final y 3er puesto generados." };
  }

  if (partidosRonda.length % 2 !== 0) {
    return { ok: false, mensaje: `Cantidad impar de partidos en ${rondaActual}, no se puede armar la siguiente ronda.` };
  }

  const siguienteRonda = ROUND_ORDER[rondaActualIdx + 1];
  const ganadores = partidosRonda.map(ganadorDe);
  const nuevos = [];
  for (let i = 0; i < ganadores.length; i += 2) {
    nuevos.push({
      categoria_id: categoriaId,
      ronda_eliminatoria: siguienteRonda,
      equipo_local_id: ganadores[i],
      equipo_visitante_id: ganadores[i + 1],
      estado: "programado" as const
    });
  }
  const { error } = await supabase.from("partidos").insert(nuevos);
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, mensaje: `${nuevos.length} partido(s) de ${siguienteRonda} generados.` };
}
