import { supabase } from "@/lib/supabase";
import { CANCHA_FEMENINO, DIA_TORNEO, FUTBOL, VOLEY, minutosDeTurno } from "@/lib/reglas";
import { ROUND_ORDER, partidosDeRonda } from "@/lib/bracket";
import type { CanchaRow, Categoria, DeporteDb, PartidoRow } from "@/lib/db-types";

/**
 * Le pone cancha y horario a los partidos de playoff que todavía no los tienen.
 *
 * - Canchas: las mismas que usó la categoría en la fase de grupos (si no hay,
 *   cualquiera compatible con el deporte). Cada mitad del cuadro va a una
 *   cancha elegida al azar y la mantiene en las rondas siguientes; la final y
 *   el 3er puesto se juegan a la par, cada uno en una cancha. Excepción: el
 *   playoff del fútbol masculino nunca usa la Cancha 3, aunque la haya usado
 *   en grupos, porque desde el mediodía es la cancha fija del femenino.
 * - Horario: cada ronda arranca cuando termina la anterior (la primera, cuando
 *   termina la fase de grupos, pero nunca antes de `FUTBOL.horaInicioPlayoff`,
 *   las 15:30) y nunca se superpone con otro partido de esa
 *   cancha, sea de la categoría que sea. Si el torneo ya está en marcha, no
 *   programa nada antes de "ahora".
 * Todo se puede cambiar después a mano.
 */

const DIA_MS = (h: number, m: number) => new Date(DIA_TORNEO.anio, DIA_TORNEO.mes - 1, DIA_TORNEO.dia, h, m).getTime();

function minutosPartido(deporte: DeporteDb, ronda: string | null): number {
  return deporte === "voley" ? VOLEY.minutosPorTurno : minutosDeTurno(ronda);
}

/** Orden en el tiempo: grupos 0, después cada ronda; final y 3er puesto juntos. */
function etapa(ronda: string | null): number {
  if (!ronda) return 0;
  if (ronda === "3er puesto") return ROUND_ORDER.indexOf("Final") + 1;
  return ROUND_ORDER.indexOf(ronda) + 1;
}

function mezclar<T>(lista: T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 0 = mitad izquierda del cuadro, 1 = derecha (null para final y 3er puesto). */
function mitadDe(p: Pick<PartidoRow, "ronda_eliminatoria" | "llave_pos">): number | null {
  const r = p.ronda_eliminatoria;
  if (!r || r === "Final" || r === "3er puesto") return null;
  return (p.llave_pos ?? 0) < partidosDeRonda(r) / 2 ? 0 : 1;
}

export async function programarCruces(categoriaId: string): Promise<{ programados: number; error?: string }> {
  if (!supabase) return { programados: 0 };

  const [{ data: catsData }, { data: canchasData }, { data: todosData }] = await Promise.all([
    supabase.from("categorias").select("*"),
    supabase.from("canchas").select("*").order("nombre"),
    supabase
      .from("partidos")
      .select("id, categoria_id, ronda_eliminatoria, llave_pos, cancha_id, fecha_hora_programada, estado")
  ]);
  const categorias = new Map(((catsData as Categoria[]) ?? []).map((c) => [c.id, c]));
  const cat = categorias.get(categoriaId);
  if (!cat) return { programados: 0, error: "Categoría no encontrada." };
  const canchas = (canchasData as CanchaRow[]) ?? [];
  const todos = (todosData as PartidoRow[]) ?? [];
  const propios = todos.filter((p) => p.categoria_id === categoriaId);

  // ---- canchas candidatas ----
  // Fútbol masculino: el playoff deja la cancha del femenino (Cancha 3) libre
  // para la liguilla, aunque el masculino la haya usado en la fase de grupos.
  const esMasculino = cat.deporte === "futbol" && cat.rama === "Masculino";
  const sinCanchaFemenino = (lista: CanchaRow[]) => (esMasculino ? lista.filter((c) => !CANCHA_FEMENINO.test(c.nombre)) : lista);
  const usadasEnGrupos = new Set(propios.filter((p) => !p.ronda_eliminatoria && p.cancha_id).map((p) => p.cancha_id as string));
  let candidatas = sinCanchaFemenino(canchas.filter((c) => usadasEnGrupos.has(c.id) && c.estado !== "fuera_de_servicio"));
  if (candidatas.length === 0) {
    candidatas = sinCanchaFemenino(
      canchas.filter((c) => c.estado !== "fuera_de_servicio" && (!c.deportes_compatibles?.length || c.deportes_compatibles.includes(cat.deporte)))
    );
  }
  if (candidatas.length === 0) return { programados: 0, error: "No hay canchas disponibles para este deporte." };

  // Cada mitad del cuadro conserva la cancha que ya tenga; si no, una al azar.
  const sorteo = mezclar(candidatas.map((c) => c.id));
  const canchaMitad: (string | null)[] = [null, null];
  for (const p of propios) {
    const m = mitadDe(p);
    if (m !== null && p.cancha_id && !canchaMitad[m]) canchaMitad[m] = p.cancha_id;
  }
  for (const m of [0, 1]) {
    if (!canchaMitad[m]) canchaMitad[m] = sorteo.find((id) => id !== canchaMitad[1 - m]) ?? sorteo[0];
  }

  // ---- ocupación de cada cancha (todas las categorías) ----
  const ocupado = new Map<string, [number, number][]>();
  const marcar = (cancha: string, ini: number, fin: number) => ocupado.set(cancha, [...(ocupado.get(cancha) ?? []), [ini, fin]]);
  for (const p of todos) {
    if (!p.cancha_id || !p.fecha_hora_programada) continue;
    const c = categorias.get(p.categoria_id);
    const ini = new Date(p.fecha_hora_programada).getTime();
    marcar(p.cancha_id, ini, ini + minutosPartido(c?.deporte ?? "futbol", p.ronda_eliminatoria) * 60_000);
  }
  const primerLibre = (cancha: string, desde: number, durMs: number) => {
    let t = desde;
    for (let vuelta = 0; vuelta < 200; vuelta++) {
      const choque = (ocupado.get(cancha) ?? []).find(([a, b]) => t < b && a < t + durMs);
      if (!choque) return t;
      t = choque[1];
    }
    return t;
  };

  // No programar en el pasado si el torneo ya arrancó, ni antes de la hora fijada para el playoff.
  const ahora = Date.now();
  const cincoMin = 5 * 60_000;
  const piso = Math.max(
    ahora > DIA_MS(0, 0) ? Math.ceil(ahora / cincoMin) * cincoMin : 0,
    DIA_MS(FUTBOL.horaInicioPlayoff.horas, FUTBOL.horaInicioPlayoff.minutos)
  );

  const finDeEtapa = (hasta: number) => {
    let fin = DIA_MS(FUTBOL.horaInicio.horas, FUTBOL.horaInicio.minutos);
    for (const p of propios) {
      if (etapa(p.ronda_eliminatoria) >= hasta || !p.fecha_hora_programada) continue;
      const ini = new Date(p.fecha_hora_programada).getTime();
      fin = Math.max(fin, ini + minutosPartido(cat.deporte, p.ronda_eliminatoria) * 60_000);
    }
    return fin;
  };

  const sinProgramar = propios
    .filter((p) => p.ronda_eliminatoria && p.estado === "programado" && (!p.cancha_id || !p.fecha_hora_programada))
    .sort((a, b) => etapa(a.ronda_eliminatoria) - etapa(b.ronda_eliminatoria) || (a.llave_pos ?? 0) - (b.llave_pos ?? 0));

  let programados = 0;
  for (const p of sinProgramar) {
    const ronda = p.ronda_eliminatoria as string;
    const durMs = minutosPartido(cat.deporte, ronda) * 60_000;
    const desde = Math.max(finDeEtapa(etapa(ronda)), piso);
    const m = mitadDe(p);

    let cancha = p.cancha_id;
    if (!cancha) {
      if (m !== null) cancha = canchaMitad[m];
      else {
        // Final y 3er puesto a la par: la final en una cancha al azar, el 3er puesto en otra.
        const otro = propios.find(
          (o) => o.id !== p.id && (o.ronda_eliminatoria === "Final" || o.ronda_eliminatoria === "3er puesto") && o.cancha_id
        );
        cancha = sorteo.find((id) => id !== otro?.cancha_id) ?? sorteo[0];
      }
    }
    const inicio = p.fecha_hora_programada ? new Date(p.fecha_hora_programada).getTime() : primerLibre(cancha as string, desde, durMs);

    const { error } = await supabase
      .from("partidos")
      .update({ cancha_id: cancha, fecha_hora_programada: new Date(inicio).toISOString() })
      .eq("id", p.id);
    if (error) return { programados, error: error.message };
    marcar(cancha as string, inicio, inicio + durMs);
    p.cancha_id = cancha;
    p.fecha_hora_programada = new Date(inicio).toISOString();
    programados++;
  }
  return { programados };
}
