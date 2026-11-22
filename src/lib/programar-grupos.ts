import { DIA_TORNEO, FUTBOL, FUTBOL_MINUTOS_POR_TURNO } from "@/lib/reglas";

export interface PartidoAProgramar {
  id: string;
  grupo_id: string | null;
  cancha_id: string | null;
  equipo_local_id: string;
  equipo_visitante_id: string;
}

export interface PartidoOcupado {
  cancha_id: string | null;
  equipo_local_id: string;
  equipo_visitante_id: string | null;
  fecha_hora_programada: string;
}

export interface OpcionesReparto {
  pendientes: PartidoAProgramar[];
  /** Lo ya programado ese día (cualquier categoría): ocupa canchas y equipos. */
  ocupados: PartidoOcupado[];
  /** Canchas de fútbol disponibles, en orden (Cancha 1, 2, 3). */
  canchas: string[];
  /** Grupos de la categoría en orden: el i-ésimo juega en la i-ésima cancha. */
  grupos: string[];
  liguilla: boolean;
  /** Cancha fija del femenino (Cancha 3). */
  canchaFemenino: string;
  /** Equipo cuyos partidos van lo más tarde posible ("Shh caiao"). */
  equipoTarde?: string | null;
}

const horaDelDia = (h: { horas: number; minutos: number }) =>
  new Date(DIA_TORNEO.anio, DIA_TORNEO.mes - 1, DIA_TORNEO.dia, h.horas, h.minutos).getTime();

/**
 * Reparte en turnos de 25' los partidos de grupos de fútbol, desde
 * `FUTBOL.horaInicio` (10:00).
 *
 * - Masculino: hasta `FUTBOL.horaInicioFemenino` (12:30) cada grupo juega en su
 *   cancha (A → 1, B → 2, C → 3) y los tres van a la par. Desde ahí la Cancha 3 es del
 *   femenino: lo que falte de cualquier grupo se juega en la 1 o la 2, en la
 *   primera que se libere (primero la propia, si es una de esas dos).
 * - Femenino (liguilla): todo en su cancha, desde las 12:30.
 * - En cada turno elige el partido que deja descansar a todos y es de los
 *   equipos que menos jugaron; `equipoTarde` arranca lo más tarde que se
 *   pueda sin jugar partidos seguidos.
 */
export function repartirTurnos(o: OpcionesReparto): { asignados: { id: string; cancha_id: string; fecha_hora_programada: string }[]; sinLugar: number } {
  const inicio = horaDelDia(FUTBOL.horaInicio);
  const turnoMs = FUTBOL_MINUTOS_POR_TURNO * 60_000;
  const finDia = horaDelDia({ horas: 23, minutos: 59 });
  const turnoFemenino = Math.max(0, Math.ceil((horaDelDia(FUTBOL.horaInicioFemenino) - inicio) / turnoMs));
  const turnoDe = (iso: string) => Math.floor((new Date(iso).getTime() - inicio) / turnoMs);

  const canchaOcupada = new Set<string>();
  const equipoOcupado = new Set<string>();
  for (const oc of o.ocupados) {
    const t = turnoDe(oc.fecha_hora_programada);
    if (oc.cancha_id) canchaOcupada.add(`${oc.cancha_id}|${t}`);
    for (const e of [oc.equipo_local_id, oc.equipo_visitante_id]) if (e) equipoOcupado.add(`${e}|${t}`);
  }

  const canchaDelGrupo = (grupoId: string | null) => {
    const i = grupoId ? o.grupos.indexOf(grupoId) : -1;
    return i >= 0 && o.canchas.length > 0 ? o.canchas[i % o.canchas.length] : null;
  };
  /** Canchas donde puede ir el partido en ese turno, en orden de preferencia. */
  const opciones = (p: PartidoAProgramar, turno: number): string[] => {
    if (o.liguilla) return o.canchaFemenino ? [o.canchaFemenino] : [];
    const propia = p.cancha_id ?? canchaDelGrupo(p.grupo_id);
    if (turno < turnoFemenino) return propia ? [propia] : o.canchas;
    const sinFemenino = o.canchas.filter((c) => c !== o.canchaFemenino);
    return propia && sinFemenino.includes(propia) ? [propia, ...sinFemenino.filter((c) => c !== propia)] : sinFemenino;
  };

  const jugados = new Map<string, number>();
  const ultimoTurno = new Map<string, number>();
  const restantes = [...o.pendientes];
  const conTarde = (p: PartidoAProgramar) => p.equipo_local_id === o.equipoTarde || p.equipo_visitante_id === o.equipoTarde;
  const grupoTarde = o.pendientes.find(conTarde)?.grupo_id;
  /**
   * El equipo "tarde" se guarda para el final de su grupo, pero sin quedarse
   * sin descanso: arranca recién cuando quedan justo los partidos del resto
   * del grupo para intercalar entre los suyos (S o S o S o S).
   */
  const postergar = (p: PartidoAProgramar) => {
    if (!o.equipoTarde || !conTarde(p) || (jugados.get(o.equipoTarde) ?? 0) > 0) return false;
    const delGrupo = restantes.filter((x) => x.grupo_id === grupoTarde);
    const suyos = delGrupo.filter(conTarde).length;
    return delGrupo.length - suyos > suyos - 1;
  };
  const asignados: { id: string; cancha_id: string; fecha_hora_programada: string }[] = [];

  for (let turno = o.liguilla ? turnoFemenino : 0; restantes.length > 0 && inicio + turno * turnoMs <= finDia; turno++) {
    for (const cancha of o.canchas) {
      if (canchaOcupada.has(`${cancha}|${turno}`)) continue;
      let mejor: { idx: number; puntaje: number } | null = null;
      for (let idx = 0; idx < restantes.length; idx++) {
        const p = restantes[idx];
        const equipos = [p.equipo_local_id, p.equipo_visitante_id];
        if (equipos.some((e) => equipoOcupado.has(`${e}|${turno}`))) continue;
        const lista = opciones(p, turno);
        const pos = lista.indexOf(cancha);
        if (pos < 0) continue;
        const tarde = postergar(p) ? 100_000 : 0;
        const seguidos = equipos.filter((e) => ultimoTurno.get(e) === turno - 1).length;
        const puntaje = tarde + seguidos * 1000 + pos * 100 + equipos.reduce((acc, e) => acc + (jugados.get(e) ?? 0), 0);
        if (!mejor || puntaje < mejor.puntaje) mejor = { idx, puntaje };
      }
      if (!mejor) continue;
      const [p] = restantes.splice(mejor.idx, 1);
      canchaOcupada.add(`${cancha}|${turno}`);
      for (const e of [p.equipo_local_id, p.equipo_visitante_id]) {
        equipoOcupado.add(`${e}|${turno}`);
        jugados.set(e, (jugados.get(e) ?? 0) + 1);
        ultimoTurno.set(e, turno);
      }
      asignados.push({ id: p.id, cancha_id: cancha, fecha_hora_programada: new Date(inicio + turno * turnoMs).toISOString() });
    }
  }
  return { asignados, sinLugar: restantes.length };
}
