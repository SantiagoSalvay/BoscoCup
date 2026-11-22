import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { categoriaLabel } from "@/lib/labels";
import { CANCHA_FEMENINO, DIA_TORNEO, FUTBOL, FUTBOL_MINUTOS_POR_TURNO, esLiguilla, horaTexto, sinPlayoff } from "@/lib/reglas";
import { IconPencil } from "@/components/icons";
import { repartirTurnos, type PartidoAProgramar, type PartidoOcupado } from "@/lib/programar-grupos";
import type { CanchaRow, Categoria, EquipoRow, PartidoRow, Profile } from "@/lib/db-types";


const ROUND_ORDER = ["Octavos", "Cuartos", "Semifinal", "3er puesto", "Final"];

/** ISO -> valor de <input type="time"> en hora local ("09:30"). */
function aHoraInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "09:30" -> ISO de esa hora el día del torneo (todos los partidos se juegan ese día). */
function horaDelTorneo(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return new Date(DIA_TORNEO.anio, DIA_TORNEO.mes - 1, DIA_TORNEO.dia, h, m).toISOString();
}

/** Todos los partidos son el mismo día, así que alcanza con la hora. */
function horarioCorto(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/** Cualquier partido que todavía no empezó (grupos o cruces) se reprograma desde su fila. */
function esProgramable(p: PartidoRow): boolean {
  return p.estado === "programado" || p.estado === "postergado" || p.estado === "suspendido";
}

/**
 * Todos contra todos por el método del círculo: devuelve las fechas en orden,
 * cada una con sus cruces, alternando localía para que quede pareja.
 */
function todosContraTodos(ids: string[]): [string, string][][] {
  const t: (string | null)[] = [...ids];
  if (t.length % 2) t.push(null);
  const n = t.length;
  const fechas: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const cruces: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i];
      const b = t[n - 1 - i];
      if (a && b) cruces.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    fechas.push(cruces);
    t.splice(1, 0, t.pop() as string | null);
  }
  return fechas;
}

const clavePar = (a: string, b: string) => [a, b].sort().join("|");
/** Par ordenado (local→visitante): hace falta en la liguilla, que juega ida y vuelta (A-B y B-A). */
const claveOrdenada = (a: string, b: string) => `${a}>${b}`;

interface PartidoConNombres extends PartidoRow {
  local_nombre: string;
  visitante_nombre: string;
  cancha_nombre: string;
  veedor_id: string | null;
}

export function AdminPartidos() {
  const [searchParams] = useSearchParams();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [canchas, setCanchas] = useState<CanchaRow[]>([]);
  const [veedores, setVeedores] = useState<Profile[]>([]);
  const [partidos, setPartidos] = useState<PartidoConNombres[]>([]);

  const [localId, setLocalId] = useState("");
  const [visitanteId, setVisitanteId] = useState("");
  const [canchaId, setCanchaId] = useState("");
  const [horario, setHorario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Fila que se está editando con el lápiz (cancha y hora sin guardar todavía). */
  const [edicion, setEdicion] = useState<{ id: string; cancha: string; hora: string } | null>(null);
  /** Grupos de la categoría, para asignarle una cancha fija a cada uno. */
  const [grupos, setGrupos] = useState<{ id: string; nombre: string }[]>([]);
  /**
   * Canchas de fútbol que ya usa el masculino (una por grupo). El femenino
   * arranca en la cancha siguiente: con 2 grupos masculinos, juega en la 3ª.
   */
  const [canchasAntes, setCanchasAntes] = useState(0);

  useEffect(() => {
    const cat = categorias.find((c) => c.id === categoriaId);
    const masculino = categorias.find((c) => c.deporte === "futbol" && c.rama === "Masculino");
    if (!supabase || !cat || cat.deporte !== "futbol" || cat.rama !== "Femenino" || !masculino) {
      setCanchasAntes(0);
      return;
    }
    supabase
      .from("grupos")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", masculino.id)
      .then(({ count }) => setCanchasAntes(Math.max(1, count ?? 0)));
  }, [categoriaId, categorias]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("categorias")
      .select("*")
      .order("deporte")
      .then(({ data }) => {
        const list = (data as Categoria[]) ?? [];
        setCategorias(list);
        const pedida = searchParams.get("categoria");
        if (pedida && list.some((c) => c.id === pedida)) setCategoriaId(pedida);
        else if (list.length > 0) setCategoriaId(list[0].id);
      });
    supabase
      .from("canchas")
      .select("*")
      .order("nombre")
      .then(({ data }) => setCanchas((data as CanchaRow[]) ?? []));
    supabase
      .from("profiles")
      .select("*")
      .eq("rol", "veedor")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setVeedores((data as Profile[]) ?? []));
  }, []);

  useEffect(() => {
    if (!supabase || !categoriaId) return;
    supabase
      .from("equipos")
      .select("*")
      .eq("categoria_id", categoriaId)
      .order("nombre")
      .then(({ data }) => setEquipos((data as EquipoRow[]) ?? []));
    supabase
      .from("grupos")
      .select("id, nombre")
      .eq("categoria_id", categoriaId)
      .order("nombre")
      .then(({ data }) => setGrupos((data as { id: string; nombre: string }[]) ?? []));
    loadPartidos(categoriaId);
  }, [categoriaId]);

  async function loadPartidos(catId: string) {
    if (!supabase || !catId) return;
    const { data: partidosData } = await supabase
      .from("partidos")
      .select("*")
      .eq("categoria_id", catId)
      .order("fecha_hora_programada");
    const rows = (partidosData as PartidoRow[]) ?? [];
    if (rows.length === 0) return setPartidos([]);

    const { data: equiposData } = await supabase.from("equipos").select("id, nombre");
    const { data: canchasData } = await supabase.from("canchas").select("id, nombre");
    const { data: asignaciones } = await supabase.from("asignaciones_veedor").select("partido_id, veedor_id");

    const equipoNombre = new Map((equiposData ?? []).map((e: { id: string; nombre: string }) => [e.id, e.nombre]));
    const canchaNombre = new Map((canchasData ?? []).map((c: { id: string; nombre: string }) => [c.id, c.nombre]));
    const asignacionPorPartido = new Map((asignaciones ?? []).map((a: { partido_id: string; veedor_id: string }) => [a.partido_id, a.veedor_id]));

    // Fase de grupos primero (por horario), después los cruces en orden de ronda.
    rows.sort((a, b) => {
      const ra = a.ronda_eliminatoria ? ROUND_ORDER.indexOf(a.ronda_eliminatoria) + 1 : 0;
      const rb = b.ronda_eliminatoria ? ROUND_ORDER.indexOf(b.ronda_eliminatoria) + 1 : 0;
      const ta = a.fecha_hora_programada ? new Date(a.fecha_hora_programada).getTime() : Infinity;
      const tb = b.fecha_hora_programada ? new Date(b.fecha_hora_programada).getTime() : Infinity;
      return (
        ra - rb ||
        (ta === tb ? 0 : ta < tb ? -1 : 1) ||
        (a.cancha_id ?? "").localeCompare(b.cancha_id ?? "") ||
        (a.orden_cancha ?? Infinity) - (b.orden_cancha ?? Infinity)
      );
    });
    setPartidos(
      rows.map((p) => ({
        ...p,
        local_nombre: equipoNombre.get(p.equipo_local_id) ?? "—",
        visitante_nombre: p.equipo_visitante_id ? equipoNombre.get(p.equipo_visitante_id) ?? "—" : "A definir",
        cancha_nombre: p.cancha_id ? canchaNombre.get(p.cancha_id) ?? "—" : "Sin asignar",
        veedor_id: asignacionPorPartido.get(p.id) ?? null
      }))
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Supabase no está configurado.");
    if (localId === visitanteId) return setError("Local y visitante no pueden ser el mismo equipo.");

    // Si los dos equipos están en el mismo grupo, el partido suma en la tabla de ese grupo.
    const { data: gruposData } = await supabase.from("grupos").select("id").eq("categoria_id", categoriaId);
    const grupoIds = ((gruposData as { id: string }[]) ?? []).map((g) => g.id);
    let grupoId: string | null = null;
    if (grupoIds.length > 0) {
      const { data: geData } = await supabase
        .from("grupo_equipos")
        .select("grupo_id, equipo_id")
        .in("grupo_id", grupoIds)
        .in("equipo_id", [localId, visitanteId]);
      const ge = (geData as { grupo_id: string; equipo_id: string }[]) ?? [];
      const grupoLocal = ge.find((x) => x.equipo_id === localId)?.grupo_id;
      const grupoVisitante = ge.find((x) => x.equipo_id === visitanteId)?.grupo_id;
      if (grupoLocal && grupoLocal === grupoVisitante) grupoId = grupoLocal;
    }

    const { error: err } = await supabase.from("partidos").insert({
      categoria_id: categoriaId,
      grupo_id: grupoId,
      equipo_local_id: localId,
      equipo_visitante_id: visitanteId || null,
      cancha_id: canchaId || null,
      fecha_hora_programada: horario ? horaDelTorneo(horario) : null
    });
    if (err) return setError(err.message);
    setHorario("");
    loadPartidos(categoriaId);
  }

  async function onDelete(p: PartidoConNombres) {
    if (!supabase) return;
    if (!window.confirm(`¿Eliminar ${p.local_nombre} vs. ${p.visitante_nombre}? Se borran también sus eventos cargados.`)) return;
    setError(null);
    const { error: err } = await supabase.from("partidos").delete().eq("id", p.id);
    if (err) return setError(`No se pudo eliminar: ${err.message}`);
    loadPartidos(categoriaId);
  }

  /**
   * Arma automáticamente el fixture de la fase de grupos: todos contra todos
   * dentro de cada grupo (o de la categoría entera si no hay grupos). No
   * duplica partidos que ya existan; quedan sin cancha ni horario para
   * completarlos fila por fila.
   */
  async function onGenerarFixture() {
    if (!supabase || !categoriaId) return;
    setError(null);
    setAviso(null);

    const [{ data: gruposData }, { data: equiposData }, { data: existentes }] = await Promise.all([
      supabase.from("grupos").select("id, nombre").eq("categoria_id", categoriaId).order("nombre"),
      supabase.from("equipos").select("id").eq("categoria_id", categoriaId),
      supabase.from("partidos").select("equipo_local_id, equipo_visitante_id").eq("categoria_id", categoriaId).is("ronda_eliminatoria", null)
    ]);
    const grupos = (gruposData as { id: string; nombre: string }[]) ?? [];
    const todos = ((equiposData as { id: string }[]) ?? []).map((e) => e.id);

    let zonas: { grupoId: string | null; equipos: string[] }[];
    if (grupos.length > 0 && !sinCuadro) {
      const { data: geData } = await supabase
        .from("grupo_equipos")
        .select("grupo_id, equipo_id")
        .in(
          "grupo_id",
          grupos.map((g) => g.id)
        );
      const ge = (geData as { grupo_id: string; equipo_id: string }[]) ?? [];
      zonas = grupos.map((g) => ({ grupoId: g.id, equipos: ge.filter((x) => x.grupo_id === g.id).map((x) => x.equipo_id) }));
      const sinGrupo = todos.filter((id) => !ge.some((x) => x.equipo_id === id));
      if (sinGrupo.length > 0) {
        return setError(`Hay ${sinGrupo.length} equipo(s) sin grupo asignado. Asignalos en Equipos antes de armar el fixture.`);
      }
    } else {
      zonas = [{ grupoId: null, equipos: todos }];
    }

    const clave = (a: string, b: string) => (liguilla ? claveOrdenada(a, b) : clavePar(a, b));
    const yaJugados = new Set(
      ((existentes as { equipo_local_id: string; equipo_visitante_id: string | null }[]) ?? [])
        .filter((p) => p.equipo_visitante_id)
        .map((p) => clave(p.equipo_local_id, p.equipo_visitante_id as string))
    );
    const canchaAzar = () => (canchasCompatibles.length > 0 ? canchasCompatibles[Math.floor(Math.random() * canchasCompatibles.length)].id : null);

    const nuevos: { categoria_id: string; grupo_id: string | null; equipo_local_id: string; equipo_visitante_id: string; cancha_id?: string | null }[] =
      [];
    for (const zona of zonas) {
      if (zona.equipos.length < 2) continue;
      const ida = todosContraTodos(zona.equipos);
      // Liguilla (femenino): ida y vuelta, local y visitante invertidos en la vuelta.
      const fechas = liguilla ? [...ida, ...ida.map((fecha) => fecha.map(([l, v]) => [v, l] as [string, string]))] : ida;
      for (const fecha of fechas) {
        for (const [local, visitante] of fecha) {
          if (yaJugados.has(clave(local, visitante))) continue;
          nuevos.push({
            categoria_id: categoriaId,
            grupo_id: zona.grupoId,
            equipo_local_id: local,
            equipo_visitante_id: visitante,
            ...(deporte === "voley" ? { cancha_id: canchaAzar() } : {})
          });
        }
      }
    }

    if (nuevos.length === 0) {
      return setAviso(todos.length < 2 ? "Cargá al menos 2 equipos para armar el fixture." : "El fixture de grupos ya está completo.");
    }
    const conHorario = deporte === "futbol";
    const horaInicioTxt = horaTexto(liguilla ? FUTBOL.horaInicioFemenino : FUTBOL.horaInicio);
    const detalle = conHorario
      ? `, con cancha y horario el domingo ${DIA_TORNEO.dia} desde las ${horaInicioTxt} (turnos de ${FUTBOL_MINUTOS_POR_TURNO}'). Después podés cambiar cualquiera con el lápiz.`
      : ", con cancha asignada al azar (el horario lo definís después con el lápiz: el vóley no tiene una duración fija, depende de los sets).";
    const formatoTxt = liguilla ? "ida y vuelta" : "todos contra todos";
    if (!window.confirm(`Se van a crear ${nuevos.length} partidos de fase de grupos (${formatoTxt})${detalle} ¿Seguimos?`)) {
      return;
    }
    const { error: err } = await supabase.from("partidos").insert(nuevos);
    if (err) return setError(`No se pudo armar el fixture: ${err.message}`);
    if (conHorario) {
      const r = await programarSinHorario();
      if (r.error) setError(`Los partidos se crearon, pero no se pudo programar el horario: ${r.error}`);
      else setAviso(`Listo: ${nuevos.length} partidos creados con cancha y horario.${r.sinLugar ? ` ${r.sinLugar} quedaron sin lugar.` : ""}`);
    } else {
      setAviso(`Listo: ${nuevos.length} partidos creados, con cancha al azar. Completá el horario con el lápiz cuando corresponda.`);
    }
    loadPartidos(categoriaId);
  }

  /**
   * Fútbol: pone cancha y horario a los partidos de grupos de la categoría que
   * todavía no tienen (reglas en `repartirTurnos`). No pisa partidos ya
   * programados de ninguna categoría.
   */
  async function programarSinHorario(): Promise<{ programados: number; sinLugar: number; error?: string }> {
    if (!supabase) return { programados: 0, sinLugar: 0, error: "Supabase no está configurado." };
    if (canchasCompatibles.length === 0) return { programados: 0, sinLugar: 0, error: "No hay canchas de fútbol cargadas." };

    const { data: pendData, error: errPend } = await supabase
      .from("partidos")
      .select("id, grupo_id, cancha_id, equipo_local_id, equipo_visitante_id")
      .eq("categoria_id", categoriaId)
      .is("ronda_eliminatoria", null)
      .is("fecha_hora_programada", null)
      .in("estado", ["programado", "postergado", "suspendido"])
      .not("equipo_visitante_id", "is", null)
      .order("created_at");
    if (errPend) return { programados: 0, sinLugar: 0, error: errPend.message };
    type Pendiente = Pick<PartidoRow, "id" | "grupo_id" | "cancha_id" | "equipo_local_id" | "equipo_visitante_id">;
    const pendientes = (pendData as Pendiente[]) ?? [];
    if (pendientes.length === 0) return { programados: 0, sinLugar: 0 };

    // "Shh caiao" (masculino): se lo relega a último momento dentro de su grupo.
    const { data: equipoTardeData } = await supabase
      .from("equipos")
      .select("id")
      .eq("categoria_id", categoriaId)
      .ilike("nombre", "shh caiao")
      .maybeSingle();
    const equipoTarde = (equipoTardeData as { id: string } | null)?.id ?? null;

    const { anio, mes, dia } = DIA_TORNEO;
    const { data: ocupadosData } = await supabase
      .from("partidos")
      .select("cancha_id, equipo_local_id, equipo_visitante_id, fecha_hora_programada")
      .gte("fecha_hora_programada", new Date(anio, mes - 1, dia, 0, 0).toISOString())
      .lte("fecha_hora_programada", new Date(anio, mes - 1, dia, 23, 59).toISOString());

    const { asignados, sinLugar } = repartirTurnos({
      pendientes: pendientes as PartidoAProgramar[],
      ocupados: (ocupadosData as PartidoOcupado[]) ?? [],
      canchas: canchasCompatibles.map((c) => c.id),
      grupos: grupos.map((g) => g.id),
      liguilla,
      canchaFemenino,
      equipoTarde
    });
    let programados = 0;
    for (const a of asignados) {
      const { error: err } = await supabase
        .from("partidos")
        .update({ cancha_id: a.cancha_id, fecha_hora_programada: a.fecha_hora_programada })
        .eq("id", a.id);
      if (err) return { programados, sinLugar, error: err.message };
      programados++;
    }
    return { programados, sinLugar };
  }

  /** Botón para completar los partidos de grupos que hayan quedado sin horario. */
  async function onCompletarHorarios() {
    setError(null);
    setAviso(null);
    const r = await programarSinHorario();
    if (r.error) setError(`No se pudo programar: ${r.error}`);
    else if (r.programados === 0 && r.sinLugar === 0) setAviso("Todos los partidos de grupos ya tienen horario.");
    else setAviso(`Listo: ${r.programados} partidos con cancha y horario.${r.sinLugar ? ` ${r.sinLugar} quedaron sin lugar.` : ""}`);
    loadPartidos(categoriaId);
  }

  /**
   * Vuelve a repartir cancha y horario de todos los partidos de grupos de la
   * categoría que todavía no empezaron (por ejemplo, después de cambiar la
   * duración de los turnos).
   */
  async function onReprogramarGrupos() {
    if (!supabase || !categoriaId) return;
    const desde = horaTexto(liguilla ? FUTBOL.horaInicioFemenino : FUTBOL.horaInicio);
    if (!window.confirm(`¿Volver a programar desde las ${desde} todos los partidos de grupos de esta categoría que todavía no empezaron?`)) return;
    setError(null);
    setAviso(null);
    const { error: err } = await supabase
      .from("partidos")
      .update({ fecha_hora_programada: null })
      .eq("categoria_id", categoriaId)
      .is("ronda_eliminatoria", null)
      .eq("estado", "programado");
    if (err) return setError(`No se pudo reprogramar: ${err.message}`);
    await onCompletarHorarios();
  }

  /** Guarda cancha y/o horario de un partido y avisa si choca con otro en la misma cancha. */
  async function onProgramarCruce(p: PartidoConNombres, cambios: { cancha_id?: string | null; fecha_hora_programada?: string | null }) {
    if (!supabase) return;
    setError(null);
    setAviso(null);
    const { error: err } = await supabase.from("partidos").update(cambios).eq("id", p.id);
    if (err) return setError(`No se pudo guardar: ${err.message}`);

    const cancha = cambios.cancha_id !== undefined ? cambios.cancha_id : p.cancha_id;
    const fecha = cambios.fecha_hora_programada !== undefined ? cambios.fecha_hora_programada : p.fecha_hora_programada;
    if (cancha && fecha) {
      const { data: choques } = await supabase
        .from("partidos")
        .select("id")
        .eq("cancha_id", cancha)
        .eq("fecha_hora_programada", fecha)
        .neq("id", p.id);
      if ((choques ?? []).length > 0) {
        const nombre = canchas.find((c) => c.id === cancha)?.nombre ?? "esa cancha";
        setAviso(`Ojo: ya hay otro partido en ${nombre} a las ${horarioCorto(fecha)}.`);
      }
    }
    loadPartidos(categoriaId);
  }

  /** Guarda lo que se cambió con el lápiz: cancha y hora (siempre el día del torneo). */
  async function onGuardarEdicion(p: PartidoConNombres) {
    if (!edicion) return;
    const { cancha, hora } = edicion;
    setEdicion(null);
    const fecha = hora ? horaDelTorneo(hora) : null;
    const fechaActual = p.fecha_hora_programada ? new Date(p.fecha_hora_programada).toISOString() : null;
    if ((cancha || null) === p.cancha_id && fecha === fechaActual) return;
    await onProgramarCruce(p, { cancha_id: cancha || null, fecha_hora_programada: fecha });
  }

  async function onAsignarVeedor(partidoId: string, veedorId: string) {
    if (!supabase) return;
    if (!veedorId) {
      await supabase.from("asignaciones_veedor").delete().eq("partido_id", partidoId);
    } else {
      await supabase.from("asignaciones_veedor").upsert({ partido_id: partidoId, veedor_id: veedorId }, { onConflict: "partido_id" });
    }
    loadPartidos(categoriaId);
  }

  const deporte = categorias.find((c) => c.id === categoriaId)?.deporte;
  const canchasCompatibles = canchas.filter(
    (c) => c.estado !== "fuera_de_servicio" && (!deporte || !c.deportes_compatibles?.length || c.deportes_compatibles.includes(deporte))
  );

  /**
   * Cancha fija de cada grupo, en orden por nombre. Masculino: grupo A → 1ª
   * cancha, grupo B → 2ª. Femenino: la cancha que sigue a las del masculino.
   */
  const categoriaSel = categorias.find((c) => c.id === categoriaId);
  const liguilla = esLiguilla(categoriaSel);
  /** Fútbol femenino o vóley: sin cuadro de playoff, una sola zona (todos contra todos). */
  const sinCuadro = sinPlayoff(categoriaSel);
  /** Femenino: siempre la Cancha 3 (por nombre); si no existe, la que sigue a las del masculino. */
  const canchaFemenino =
    canchas.find((c) => c.estado !== "fuera_de_servicio" && CANCHA_FEMENINO.test(c.nombre))?.id ??
    (canchasCompatibles.length > 0 ? canchasCompatibles[canchasAntes % canchasCompatibles.length].id : "");

  function canchaGrupo(grupoId: string): string {
    if (liguilla) return canchaFemenino;
    const i = grupos.findIndex((g) => g.id === grupoId);
    if (i < 0 || canchasCompatibles.length === 0) return "";
    return canchasCompatibles[(canchasAntes + i) % canchasCompatibles.length].id;
  }

  return (
    <div>
      <h2 className="page-title">Partidos</h2>
      <p className="form-hint">
        El fixture de la fase de grupos se arma solo (todos contra todos dentro de cada grupo). Los cruces se
        generan desde la sección Cruces. A cualquier partido que todavía no empezó le podés cambiar la cancha y
        el horario directamente en su fila.
      </p>

      <label className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
        <span>Categoría</span>
        <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {categoriaLabel(c)}
            </option>
          ))}
        </select>
      </label>

      <section className="panel fixture-panel">
        <div>
          <h3 className="panel-title">Fixture de fase de grupos</h3>
          <p className="form-hint" style={{ margin: 0 }}>
            Crea todos los partidos que falten entre los equipos de cada grupo. No duplica los que ya existen.
          </p>
        </div>
        <button className="btn btn-accent" type="button" onClick={onGenerarFixture} disabled={!categoriaId}>
          Armar fixture
        </button>
      </section>

      {deporte === "futbol" && (
        <section className="panel fixture-panel">
          <div>
            <h3 className="panel-title">Horarios de fútbol</h3>
            <p className="form-hint" style={{ margin: 0 }}>
              Todo se juega el domingo {DIA_TORNEO.dia}/{DIA_TORNEO.mes}. Puertas 8:00 · masculino arranca {horaTexto(FUTBOL.horaInicio)} ·
              femenino (liguilla, ida y vuelta) arranca {horaTexto(FUTBOL.horaInicioFemenino)} en{" "}
              {canchas.find((c) => c.id === canchaFemenino)?.nombre ?? "su cancha"}. Cada partido dura {FUTBOL_MINUTOS_POR_TURNO}': 2 tiempos de{" "}
              {FUTBOL.minutosPorTiempoGrupos}' con {FUTBOL.minutosDescanso}' de descanso, y al terminar uno arranca el siguiente. Solo la
              final se juega en 2 tiempos de {FUTBOL.minutosPorTiempo}'. Hasta las {horaTexto(FUTBOL.horaInicioFemenino)} cada grupo masculino juega
              en su cancha (las 3 a la par); desde esa hora lo que falte, y el playoff, va solo a las canchas 1 y 2. En playoff, si
              empatan, van a penales (tanda de {FUTBOL.penalesPorEquipo}).
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            {liguilla ? (
              <span className="form-hint" style={{ margin: 0 }}>
                Liguilla (ida y vuelta) → {canchas.find((c) => c.id === canchaFemenino)?.nombre ?? "sin cancha"} desde las{" "}
                {horaTexto(FUTBOL.horaInicioFemenino)}
              </span>
            ) : (
              grupos.length > 0 && (
                <span className="form-hint" style={{ margin: 0 }}>
                  {grupos
                    .map((g) => `${g.nombre} → ${canchasCompatibles.find((c) => c.id === canchaGrupo(g.id))?.nombre ?? "sin cancha"}`)
                    .join(" · ")}
                </span>
              )
            )}
            <button className="btn btn-ghost" type="button" onClick={onCompletarHorarios}>
              Completar horarios faltantes
            </button>
            <button className="btn btn-ghost" type="button" onClick={onReprogramarGrupos}>
              Reprogramar grupos
            </button>
          </div>
        </section>
      )}

      <details className="panel manual-match">
        <summary>Agregar un partido a mano (desempates, amistosos)</summary>
      <form className="form-row" onSubmit={onSubmit}>
        <label className="field">
          <span>Local</span>
          <select className="input" value={localId} onChange={(e) => setLocalId(e.target.value)} required>
            <option value="">Elegir…</option>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Visitante</span>
          <select className="input" value={visitanteId} onChange={(e) => setVisitanteId(e.target.value)} required>
            <option value="">Elegir…</option>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cancha</span>
          <select className="input" value={canchaId} onChange={(e) => setCanchaId(e.target.value)}>
            <option value="">Sin asignar</option>
            {canchas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Hora (domingo {DIA_TORNEO.dia})</span>
          <input className="input" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          Programar partido
        </button>
      </form>
      </details>
      {error && <p className="form-error">{error}</p>}
      {aviso && <p className="form-hint form-hint-warn">{aviso}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Partido</th>
              <th>Cancha</th>
              <th>Hora</th>
              <th>Estado</th>
              <th>Veedor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {partidos.map((p) => {
              const editable = esProgramable(p);
              const faltaProgramar = editable && (!p.cancha_id || !p.fecha_hora_programada);
              const enEdicion = editable && edicion?.id === p.id ? edicion : null;
              return (
              <tr key={p.id} className={faltaProgramar ? "row-pending" : ""}>
                <td>
                  {p.local_nombre} vs. {p.visitante_nombre}
                  {p.ronda_eliminatoria && <span className="round-tag">{p.ronda_eliminatoria}</span>}
                  {faltaProgramar && <span className="row-note">Falta {!p.cancha_id && !p.fecha_hora_programada ? "cancha y horario" : !p.cancha_id ? "cancha" : "horario"}</span>}
                </td>
                <td>
                  {enEdicion ? (
                    <select
                      className="input input-sm"
                      value={enEdicion.cancha}
                      onChange={(e) => setEdicion({ ...enEdicion, cancha: e.target.value })}
                      aria-label={`Cancha de ${p.local_nombre} vs. ${p.visitante_nombre}`}
                    >
                      <option value="">Sin asignar</option>
                      {canchasCompatibles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      {p.cancha_nombre || "—"}
                      {p.orden_cancha && <span className="row-note">{p.orden_cancha}º en la cancha</span>}
                    </>
                  )}
                </td>
                <td className="tnum">
                  {enEdicion ? (
                    <span className="edit-inline">
                      <input
                        className="input input-sm"
                        type="time"
                        value={enEdicion.hora}
                        onChange={(e) => setEdicion({ ...enEdicion, hora: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && onGuardarEdicion(p)}
                        aria-label={`Hora de ${p.local_nombre} vs. ${p.visitante_nombre}`}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => onGuardarEdicion(p)}>
                        Guardar
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEdicion(null)}>
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <span className="edit-inline">
                      {horarioCorto(p.fecha_hora_programada)}
                      {editable && (
                        <button
                          className="pencil-btn"
                          onClick={() => setEdicion({ id: p.id, cancha: p.cancha_id ?? "", hora: aHoraInput(p.fecha_hora_programada) })}
                          aria-label={`Cambiar cancha y hora de ${p.local_nombre} vs. ${p.visitante_nombre}`}
                          title="Cambiar cancha y hora"
                        >
                          <IconPencil />
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td>
                  <span className="badge-estado">{p.estado}</span>
                </td>
                <td>
                  <select className="input input-sm" value={p.veedor_id ?? ""} onChange={(e) => onAsignarVeedor(p.id, e.target.value)}>
                    <option value="">Sin asignar</option>
                    {veedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="row-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(p)}>
                    Eliminar
                  </button>
                </td>
              </tr>
              );
            })}
            {partidos.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  Todavía no hay partidos programados en esta categoría.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
