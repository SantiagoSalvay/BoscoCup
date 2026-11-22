import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { cancelQueuedInsert, insertWithFallback, isQueued, updateWithFallback } from "@/lib/offline-queue";
import { useSyncStatus } from "@/lib/use-sync-status";
import { useMatchClock } from "@/lib/use-match-clock";
import type { EquipoRow, EventoPartidoRow, EventoTipo, JugadorRow, PartidoEstado } from "@/lib/db-types";
import { IconCard, IconGol, IconGoalOwn, IconIncidencia, IconSync, IconUndo } from "@/components/icons";
import { FUTBOL, minutosPorTiempo } from "@/lib/reglas";
import { fetchTarjetasEquipo, type Suspension } from "@/lib/suspensiones";
import { estadoTanda, tirosDesdeEventos } from "@/lib/tanda-penales";
import { useCapa } from "@/lib/historial";

/** En qué parte del partido está el veedor (en la base sigue "en_juego"). */
type Fase = "juego" | "fin2T" | "penales";

const faseKey = (partidoId: string) => `boscocup-fase-${partidoId}`;
function leerFase(partidoId: string): Fase {
  try {
    const f = localStorage.getItem(faseKey(partidoId));
    if (f === "fin2T" || f === "penales") return f;
  } catch {
    // sin almacenamiento: arranca en juego
  }
  return "juego";
}
function guardarFase(partidoId: string, fase: Fase) {
  try {
    if (fase === "juego") localStorage.removeItem(faseKey(partidoId));
    else localStorage.setItem(faseKey(partidoId), fase);
  } catch {
    // ignore
  }
}

interface Props {
  partidoId: string;
  equipoLocal: EquipoRow;
  equipoVisitante: EquipoRow;
  jugadoresLocal: JugadorRow[];
  jugadoresVisitante: JugadorRow[];
  estadoInicial: PartidoEstado;
  esEliminatoria: boolean;
  ronda: string | null;
}

type Step = "equipo" | "jugador" | "texto";

interface SheetState {
  tipo: EventoTipo;
  step: Step;
  equipoId?: string;
}

/** Lo que cobra el veedor en fútbol: goles, amarillas y rojas. */
const ACCIONES: { tipo: EventoTipo; label: string; icon: typeof IconGol; className: string }[] = [
  { tipo: "gol", label: "Gol", icon: IconGol, className: "gol" },
  { tipo: "tarjeta_amarilla", label: "Amarilla", icon: IconCard, className: "amarilla" },
  { tipo: "tarjeta_roja", label: "Roja", icon: IconCard, className: "roja" }
];

/** Casos menos frecuentes, en botones más chicos. */
const ACCIONES_EXTRA: { tipo: EventoTipo; label: string; icon: typeof IconGol }[] = [
  { tipo: "gol_en_contra", label: "Gol en contra", icon: IconGoalOwn },
  { tipo: "incidencia", label: "Incidencia", icon: IconIncidencia }
];

const TODAS = [...ACCIONES, ...ACCIONES_EXTRA];

const TIPO_TEXTO: Partial<Record<EventoTipo, string>> = {
  gol: "Gol",
  gol_en_contra: "Gol en contra",
  penal_convertido: "Gol de penal",
  tarjeta_amarilla: "Amarilla",
  tarjeta_roja: "Roja",
  doble_amarilla: "Doble amarilla (roja)",
  cambio: "Cambio (entra)",
  incidencia: "Incidencia",
  tanda_convertido: "Penal convertido (tanda)",
  tanda_errado: "Penal errado (tanda)"
};

export function PartidoEnVivo({
  partidoId,
  equipoLocal,
  equipoVisitante,
  jugadoresLocal,
  jugadoresVisitante,
  estadoInicial,
  esEliminatoria,
  ronda
}: Props) {
  const navigate = useNavigate();
  const minutos = minutosPorTiempo(ronda);
  const clock = useMatchClock(partidoId, minutos);
  const sync = useSyncStatus();
  // Hojas con entrada en el historial: "atrás" las cierra sin salir del partido.
  const capaEvento = useCapa("evento");
  const capaConfirmar = useCapa("confirmar");

  /** Vuelve a la lista de partidos sacando este de la pila de "atrás". */
  function volverAlPanel() {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate("/veedor", { replace: true });
  }

  const [estado, setEstado] = useState<PartidoEstado>(estadoInicial);
  const [eventos, setEventos] = useState<EventoPartidoRow[]>([]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [texto, setTexto] = useState("");
  const [confirmState, setConfirmState] = useState<{ mensaje: string; accion: () => void } | null>(null);
  const [fase, setFaseState] = useState<Fase>(() => leerFase(partidoId));
  // Quién patea primero en la tanda (antes del primer tiro lo elige el veedor).
  const [primeroElegido, setPrimeroElegido] = useState<string | null>(null);

  function setFase(f: Fase) {
    setFaseState(f);
    guardarFase(partidoId, f);
  }

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("eventos_partido")
      .select("*")
      .eq("partido_id", partidoId)
      .order("creado_en", { ascending: true })
      .then(({ data }) => {
        const lista = (data as EventoPartidoRow[]) ?? [];
        setEventos(lista);
        // Si ya hay tiros cargados (otro dispositivo, recarga), se retoma la tanda.
        if (tirosDesdeEventos(lista).length > 0) setFase("penales");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  const [otroDispositivo, setOtroDispositivo] = useState(false);

  // Suspendidos por tarjetas de partidos anteriores (no deberían jugar este).
  const [suspendidos, setSuspendidos] = useState<Map<string, Suspension>>(new Map());
  useEffect(() => {
    let active = true;
    Promise.all([fetchTarjetasEquipo(equipoLocal.id, partidoId), fetchTarjetasEquipo(equipoVisitante.id, partidoId)]).then(
      ([l, v]) => active && setSuspendidos(new Map([...l.suspendidos, ...v.suspendidos]))
    );
    return () => {
      active = false;
    };
  }, [partidoId, equipoLocal.id, equipoVisitante.id]);

  // Lock advisorio: avisa si otro dispositivo pudo haber abierto este partido hace poco.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;
    client
      .from("asignaciones_veedor")
      .select("bloqueado_en")
      .eq("partido_id", partidoId)
      .single()
      .then(({ data }) => {
        if (!mounted || !data?.bloqueado_en) return;
        const ageMs = Date.now() - new Date(data.bloqueado_en).getTime();
        if (ageMs < 60_000) setOtroDispositivo(true);
      });
    const heartbeat = setInterval(() => {
      client.from("asignaciones_veedor").update({ bloqueado_en: new Date().toISOString() }).eq("partido_id", partidoId);
    }, 20_000);
    client.from("asignaciones_veedor").update({ bloqueado_en: new Date().toISOString() }).eq("partido_id", partidoId);
    return () => {
      mounted = false;
      clearInterval(heartbeat);
    };
  }, [partidoId]);

  const jugadorMap = useMemo(() => {
    const m = new Map<string, JugadorRow>();
    [...jugadoresLocal, ...jugadoresVisitante].forEach((j) => m.set(j.id, j));
    return m;
  }, [jugadoresLocal, jugadoresVisitante]);

  const score = useMemo(() => {
    let local = 0;
    let visitante = 0;
    for (const e of eventos) {
      if (e.anulado) continue;
      if (e.tipo === "gol" || e.tipo === "penal_convertido") {
        if (e.equipo_id === equipoLocal.id) local++;
        else if (e.equipo_id === equipoVisitante.id) visitante++;
      } else if (e.tipo === "gol_en_contra") {
        if (e.equipo_id === equipoLocal.id) visitante++;
        else if (e.equipo_id === equipoVisitante.id) local++;
      }
    }
    return { local, visitante };
  }, [eventos, equipoLocal.id, equipoVisitante.id]);

  const expulsados = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventos) {
      if (e.anulado || !e.jugador_id) continue;
      if (e.tipo === "tarjeta_roja" || e.tipo === "doble_amarilla") set.add(e.jugador_id);
    }
    return set;
  }, [eventos]);

  const amarillasPorJugador = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of eventos) {
      if (e.anulado || !e.jugador_id || e.tipo !== "tarjeta_amarilla") continue;
      m.set(e.jugador_id, (m.get(e.jugador_id) ?? 0) + 1);
    }
    return m;
  }, [eventos]);

  function jugadoresDe(equipoId: string): JugadorRow[] {
    return equipoId === equipoLocal.id ? jugadoresLocal : jugadoresVisitante;
  }

  function openSheet(tipo: EventoTipo) {
    setTexto("");
    setSheet({ tipo, step: "equipo" });
    capaEvento.abrir();
  }
  function closeSheet() {
    setSheet(null);
    capaEvento.cerrar();
  }
  function pedirConfirmacion(c: { mensaje: string; accion: () => void }) {
    setConfirmState(c);
    capaConfirmar.abrir();
  }
  function cerrarConfirmacion() {
    setConfirmState(null);
    capaConfirmar.cerrar();
  }

  async function confirmarEvento(payload: { equipoId: string | null; jugadorId: string | null; texto?: string }) {
    if (!sheet) return;
    let tipo: EventoTipo = sheet.tipo;

    if (tipo === "tarjeta_amarilla" && payload.jugadorId && (amarillasPorJugador.get(payload.jugadorId) ?? 0) >= 1) {
      tipo = "doble_amarilla";
    }

    const id = crypto.randomUUID();
    const detalle: Record<string, unknown> = {};
    if (payload.texto) detalle.texto = payload.texto.trim().slice(0, 500);

    const row: EventoPartidoRow = {
      id,
      partido_id: partidoId,
      tipo,
      equipo_id: payload.equipoId,
      jugador_id: payload.jugadorId,
      jugador_asistencia_id: null,
      minuto: clock.minuto,
      detalle,
      anulado: false,
      creado_en: new Date().toISOString()
    };

    setEventos((prev) => [...prev, row]);
    closeSheet();

    await insertWithFallback("eventos_partido", {
      id,
      partido_id: partidoId,
      tipo,
      equipo_id: payload.equipoId,
      jugador_id: row.jugador_id,
      jugador_asistencia_id: null,
      minuto: clock.minuto,
      detalle
    });
    sync.refresh();
  }

  function deshacer() {
    const ultimo = [...eventos].filter((e) => !e.anulado).at(-1);
    if (!ultimo) return;
    pedirConfirmacion({
      mensaje: `¿Deshacer "${TIPO_TEXTO[ultimo.tipo] ?? ultimo.tipo.replace(/_/g, " ")}"?`,
      accion: () => aplicarDeshacer(ultimo)
    });
  }

  async function aplicarDeshacer(ultimo: EventoPartidoRow) {
    const siguientes = eventos.map((e) => (e.id === ultimo.id ? { ...e, anulado: true } : e));
    setEventos(siguientes);

    if (isQueued(ultimo.id)) {
      cancelQueuedInsert(ultimo.id);
    } else {
      await updateWithFallback("eventos_partido", ultimo.id, { anulado: true });
    }
    if (ultimo.tipo === "tanda_convertido" || ultimo.tipo === "tanda_errado") await guardarPenales(siguientes);
    sync.refresh();
  }

  // ---- tanda de penales ----
  const tiros = useMemo(() => tirosDesdeEventos(eventos), [eventos]);
  const primero = tiros[0]?.equipoId ?? primeroElegido;
  const segundo = primero === equipoLocal.id ? equipoVisitante.id : equipoLocal.id;
  const tanda = primero ? estadoTanda(tiros, primero, segundo, FUTBOL.penalesPorEquipo) : null;
  const golesTanda = (equipoId: string) => tiros.filter((t) => t.equipoId === equipoId && t.convertido).length;
  const penLocal = golesTanda(equipoLocal.id);
  const penVisitante = golesTanda(equipoVisitante.id);
  const nombreDe = (id: string | null) => (id === equipoLocal.id ? equipoLocal.nombre : id === equipoVisitante.id ? equipoVisitante.nombre : "");

  /** Deja el resultado parcial de la tanda en el partido, para que el público lo vea en vivo. */
  async function guardarPenales(lista: EventoPartidoRow[]) {
    const t = tirosDesdeEventos(lista);
    const de = (id: string) => t.filter((x) => x.equipoId === id && x.convertido).length;
    await updateWithFallback("partidos", partidoId, {
      penales_local: de(equipoLocal.id),
      penales_visitante: de(equipoVisitante.id)
    });
  }

  function finalizarSegundoTiempo() {
    if (!empatadoEnEliminatoria) {
      finalizarPartido();
      return;
    }
    pedirConfirmacion({
      mensaje: `¿Terminó el 2do tiempo ${score.local}-${score.visitante}? Al estar empatados se define por penales.`,
      accion: () => {
        clock.detener();
        setFase("fin2T");
      }
    });
  }

  function reanudarSegundoTiempo() {
    clock.reanudar();
    setFase("juego");
  }

  async function iniciarPenales() {
    setPrimeroElegido(null);
    setFase("penales");
    // 0-0 en la tanda: el público ya ve que se patean penales.
    await updateWithFallback("partidos", partidoId, { penales_local: 0, penales_visitante: 0 });
    sync.refresh();
  }

  async function patearPenal(convertido: boolean) {
    if (!tanda?.turno) return;
    const equipoId = tanda.turno;
    const id = crypto.randomUUID();
    const tipo: EventoTipo = convertido ? "tanda_convertido" : "tanda_errado";
    const detalle = { ronda: tanda.ronda };
    const row: EventoPartidoRow = {
      id,
      partido_id: partidoId,
      tipo,
      equipo_id: equipoId,
      jugador_id: null,
      jugador_asistencia_id: null,
      minuto: clock.minuto,
      detalle,
      anulado: false,
      creado_en: new Date().toISOString()
    };
    const siguientes = [...eventos, row];
    setEventos(siguientes);
    await insertWithFallback("eventos_partido", {
      id,
      partido_id: partidoId,
      tipo,
      equipo_id: equipoId,
      jugador_id: null,
      jugador_asistencia_id: null,
      minuto: clock.minuto,
      detalle
    });
    await guardarPenales(siguientes);
    sync.refresh();
  }

  async function cambiarEstado(nuevo: PartidoEstado) {
    setEstado(nuevo);
    if (!supabase) return;
    await supabase.from("partidos").update({ estado: nuevo }).eq("id", partidoId);
  }

  function finalizarPartido() {
    pedirConfirmacion({
      mensaje: `¿Finalizar el partido ${score.local}-${score.visitante}? No se va a poder seguir cargando eventos.`,
      accion: aplicarFinalizar
    });
  }

  async function aplicarFinalizar() {
    clock.detener();
    setEstado("finalizado");
    setFase("juego");
    if (!supabase) return;
    await supabase
      .from("partidos")
      // Sin penales: se limpia por si se había empezado una tanda.
      .update({ estado: "finalizado", resultado_local: score.local, resultado_visitante: score.visitante, penales_local: null, penales_visitante: null })
      .eq("id", partidoId);
    volverAlPanel();
  }

  const empatadoEnEliminatoria = esEliminatoria && score.local === score.visitante;

  function finalizarPorPenales() {
    if (!tanda?.ganador) return;
    pedirConfirmacion({
      mensaje: `¿Finalizar ${score.local}-${score.visitante} (penales ${penLocal}-${penVisitante})? Gana ${nombreDe(tanda.ganador)}.`,
      accion: aplicarFinalizarPenales
    });
  }

  async function aplicarFinalizarPenales() {
    clock.detener();
    setEstado("finalizado");
    setFase("juego");
    if (!supabase) return;
    await supabase
      .from("partidos")
      .update({
        estado: "finalizado",
        resultado_local: score.local,
        resultado_visitante: score.visitante,
        penales_local: penLocal,
        penales_visitante: penVisitante
      })
      .eq("id", partidoId);
    volverAlPanel();
  }

  const equipoSel = sheet?.equipoId === equipoLocal.id ? equipoLocal : sheet?.equipoId === equipoVisitante.id ? equipoVisitante : null;

  return (
    <div className="veedor-page">
      <div className="v-live-top">
        <div className="sync-chip-row">
          <span className={`sync-chip ${sync.online ? "" : "off"}`}>
            <IconSync />
            {sync.online ? (sync.pending > 0 ? `Sincronizando (${sync.pending})` : "Sincronizado") : "Sin conexión"}
          </span>
        </div>

        {otroDispositivo && <p className="form-hint form-hint-warn">Este partido pudo abrirse hace instantes en otro dispositivo.</p>}
        {suspendidos.size > 0 && (
          <p className="form-hint form-hint-warn">
            <b>No pueden jugar este partido (suspendidos):</b>{" "}
            {[...suspendidos.entries()]
              .map(([id, s]) => `${jugadorMap.get(id)?.nombre ?? "—"} (${s.motivo})`)
              .join(", ")}
          </p>
        )}

        <div className="v-score-row">
          <div className="v-team">
            <span className="color-dot" style={{ background: equipoLocal.color_primario }} />
            {equipoLocal.nombre}
          </div>
          <div className="v-score tnum">
            {score.local}
            <span>—</span>
            {score.visitante}
            {fase === "penales" && (
              <small className="v-score-pen">
                Penales {penLocal}-{penVisitante}
              </small>
            )}
          </div>
          <div className="v-team">
            <span className="color-dot" style={{ background: equipoVisitante.color_primario }} />
            {equipoVisitante.nombre}
          </div>
        </div>

        <div className="v-clock-row">
          <span className="v-clock tnum">{clock.label}</span>
          <span className="badge-estado">
            {estado === "en_juego" && fase === "penales" ? "penales" : estado === "en_juego" && fase === "fin2T" ? "fin del 2do tiempo" : estado.replace("_", " ")}
          </span>
        </div>
        <p className="form-hint" style={{ textAlign: "center", margin: "2px 0 8px" }}>
          {ronda === "Final" ? "Final: " : ""}2 tiempos de {minutos}' · descanso {FUTBOL.minutosDescanso}'
          {esEliminatoria ? ` · si empatan, penales (tanda de ${FUTBOL.penalesPorEquipo})` : ""}
        </p>

        <div className="v-clock-controls">
          {estado === "programado" && (
            <button className="btn btn-primary btn-sm" onClick={() => { clock.iniciar1T(); cambiarEstado("en_juego"); }}>
              Iniciar 1er tiempo
            </button>
          )}
          {estado === "en_juego" && clock.periodo === "1T" && (
            <button className="btn btn-ghost btn-sm" onClick={() => { clock.entretiempo(); cambiarEstado("entretiempo"); }}>
              Entretiempo
            </button>
          )}
          {estado === "entretiempo" && (
            <button className="btn btn-primary btn-sm" onClick={() => { clock.iniciar2T(); cambiarEstado("en_juego"); }}>
              Iniciar 2do tiempo
            </button>
          )}
          {estado === "en_juego" && fase === "juego" && clock.periodo === "2T" && (
            <button className="btn btn-danger btn-sm" onClick={finalizarSegundoTiempo}>
              Finalizar 2do tiempo
            </button>
          )}
          {estado === "en_juego" && fase === "fin2T" && empatadoEnEliminatoria && (
            <button className="btn btn-primary btn-sm" onClick={iniciarPenales}>
              Iniciar penales
            </button>
          )}
          {estado === "en_juego" && fase === "fin2T" && !empatadoEnEliminatoria && (
            <button className="btn btn-danger btn-sm" onClick={finalizarPartido}>
              Finalizar partido
            </button>
          )}
          {estado === "en_juego" && fase === "fin2T" && (
            <button className="btn btn-ghost btn-sm" onClick={reanudarSegundoTiempo}>
              Reanudar 2do tiempo
            </button>
          )}
        </div>
      </div>

      {estado === "en_juego" && fase === "penales" && (
        <section className="v-tanda" aria-label="Tanda de penales">
          <div className="v-tanda-head">
            <b>Tanda de penales</b>
            <span>
              {tanda?.ganador
                ? `Gana ${nombreDe(tanda.ganador)}`
                : tanda?.muerteSubita
                ? `Muerte súbita · tiro ${tanda.ronda}`
                : tanda
                ? `Tiro ${tanda.ronda} de ${FUTBOL.penalesPorEquipo}`
                : `${FUTBOL.penalesPorEquipo} tiros por equipo`}
            </span>
          </div>

          {!tanda ? (
            <>
              <p className="form-hint" style={{ margin: "0 0 10px" }}>¿Quién patea primero?</p>
              <div className="sheet-options">
                {[equipoLocal, equipoVisitante].map((eq) => (
                  <button key={eq.id} className="sheet-option" onClick={() => setPrimeroElegido(eq.id)}>
                    <span className="color-dot" style={{ background: eq.color_primario }} />
                    {eq.nombre}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {[primero as string, segundo].map((id) => {
                const eq = id === equipoLocal.id ? equipoLocal : equipoVisitante;
                const lista = tanda.tiros[id] ?? [];
                const casillas = Math.max(FUTBOL.penalesPorEquipo, lista.length);
                return (
                  <div className={`v-tanda-fila ${tanda.turno === id ? "turno" : ""}`} key={id}>
                    <span className="v-tanda-equipo">
                      <span className="color-dot" style={{ background: eq.color_primario }} />
                      {eq.nombre}
                    </span>
                    <span className="v-tanda-tiros">
                      {Array.from({ length: casillas }, (_, k) => (
                        <i
                          key={k}
                          className={lista[k] === undefined ? "" : lista[k] ? "si" : "no"}
                          aria-label={lista[k] === undefined ? "Sin patear" : lista[k] ? "Convertido" : "Errado"}
                        >
                          {lista[k] === undefined ? "" : lista[k] ? "✓" : "✕"}
                        </i>
                      ))}
                    </span>
                    <b className="tnum">{tanda.goles[id]}</b>
                  </div>
                );
              })}

              {tanda.turno ? (
                <>
                  <p className="v-tanda-turno">
                    Patea <b>{nombreDe(tanda.turno)}</b>
                  </p>
                  <div className="v-tanda-btns">
                    <button className="v-btn gol" onClick={() => patearPenal(true)}>
                      ✓ Convertido
                    </button>
                    <button className="v-btn roja" onClick={() => patearPenal(false)}>
                      ✕ Errado
                    </button>
                  </div>
                  {tiros.length === 0 && (
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setPrimeroElegido(null)}>
                      Cambiar quién patea primero
                    </button>
                  )}
                </>
              ) : (
                <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={finalizarPorPenales}>
                  Finalizar partido · gana {nombreDe(tanda.ganador)} {Math.max(penLocal, penVisitante)}-{Math.min(penLocal, penVisitante)}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <div className="v-grid v-grid-main">
        {ACCIONES.map((a) => (
          <button key={a.tipo} className={`v-btn ${a.className}`} onClick={() => openSheet(a.tipo)} disabled={estado === "finalizado" || (fase === "penales" && a.tipo === "gol")}>
            <a.icon />
            {a.label}
          </button>
        ))}
      </div>
      <div className="v-extra">
        {ACCIONES_EXTRA.map((a) => (
          <button key={a.tipo} type="button" onClick={() => openSheet(a.tipo)} disabled={estado === "finalizado" || (fase === "penales" && a.tipo === "gol_en_contra")}>
            <a.icon />
            {a.label}
          </button>
        ))}
      </div>

      <div className="v-foot">
        <button onClick={deshacer} disabled={eventos.filter((e) => !e.anulado).length === 0}>
          <IconUndo />
          Deshacer último evento
        </button>
      </div>

      <div className="timeline">
        {[...eventos]
          .filter((e) => !e.anulado)
          .reverse()
          .map((e) => (
            <div className="tl-item" key={e.id}>
              <div className="minute tnum">{e.minuto}'</div>
              <div className="desc">
                <b>{TIPO_TEXTO[e.tipo] ?? e.tipo.replace(/_/g, " ")}</b>
                {e.jugador_id && ` — ${jugadorMap.get(e.jugador_id)?.nombre ?? ""}`}
                {(e.detalle as { texto?: string })?.texto && <div className="assist">{(e.detalle as { texto?: string }).texto}</div>}
              </div>
            </div>
          ))}
        {eventos.filter((e) => !e.anulado).length === 0 && <p className="form-hint">Todavía no hay eventos cargados.</p>}
      </div>

      {sheet && capaEvento.abierta && (
        <div className="sheet-overlay" onClick={closeSheet}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">{TODAS.find((a) => a.tipo === sheet.tipo)?.label}</div>

            {sheet.step === "equipo" && (
              <div className="sheet-options">
                <button
                  className="sheet-option"
                  onClick={() => setSheet({ ...sheet, equipoId: equipoLocal.id, step: sheet.tipo === "incidencia" ? "texto" : "jugador" })}
                >
                  <span className="color-dot" style={{ background: equipoLocal.color_primario }} />
                  {equipoLocal.nombre}
                </button>
                <button
                  className="sheet-option"
                  onClick={() => setSheet({ ...sheet, equipoId: equipoVisitante.id, step: sheet.tipo === "incidencia" ? "texto" : "jugador" })}
                >
                  <span className="color-dot" style={{ background: equipoVisitante.color_primario }} />
                  {equipoVisitante.nombre}
                </button>
                {sheet.tipo === "incidencia" && (
                  <button className="sheet-option" onClick={() => setSheet({ ...sheet, equipoId: undefined, step: "texto" })}>
                    General (sin equipo)
                  </button>
                )}
              </div>
            )}

            {sheet.step === "jugador" && equipoSel && (
              <div className="sheet-options">
                {sheet.tipo === "gol_en_contra" && (
                  <p className="form-hint" style={{ margin: "0 0 4px" }}>
                    Elegí al jugador de {equipoSel.nombre} que la metió en su arco: el gol se suma al rival.
                  </p>
                )}
                {jugadoresDe(equipoSel.id).map((j) => {
                  const amarillas = amarillasPorJugador.get(j.id) ?? 0;
                  const afuera = expulsados.has(j.id);
                  const suspension = suspendidos.get(j.id);
                  return (
                    <button
                      key={j.id}
                      className={`sheet-option ${afuera ? "disabled-look" : ""}`}
                      onClick={() => confirmarEvento({ equipoId: sheet.equipoId ?? null, jugadorId: j.id })}
                    >
                      {j.nombre}
                      {j.es_capitan && <span className="captain-badge" aria-label="Capitán">C</span>}
                      {amarillas > 0 && !afuera && <i className="tcard y" aria-label="Tiene amarilla" />}
                      {afuera && <span className="sheet-option-note">expulsado</span>}
                      {!afuera && suspension && <span className="sheet-option-note warn">suspendido ({suspension.motivo})</span>}
                    </button>
                  );
                })}
                <button className="sheet-option disabled-look" onClick={() => confirmarEvento({ equipoId: sheet.equipoId ?? null, jugadorId: null })}>
                  Jugador sin identificar
                </button>
              </div>
            )}

            {sheet.step === "texto" && (
              <div className="sheet-options">
                <textarea className="input" rows={3} placeholder="Describí lo que pasó…" value={texto} onChange={(e) => setTexto(e.target.value)} />
                <button className="btn btn-primary" onClick={() => confirmarEvento({ equipoId: sheet.equipoId ?? null, jugadorId: null, texto })} disabled={!texto.trim()}>
                  Confirmar
                </button>
              </div>
            )}

            <button className="btn btn-ghost" style={{ marginTop: 10, width: "100%" }} onClick={closeSheet}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmState && capaConfirmar.abierta && (
        <div className="sheet-overlay" onClick={cerrarConfirmacion}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">Confirmar</div>
            <p className="form-hint" style={{ margin: "0 0 14px" }}>
              {confirmState.mensaje}
            </p>
            <div className="sheet-options">
              <button
                className="btn btn-primary"
                onClick={() => {
                  const { accion } = confirmState;
                  cerrarConfirmacion();
                  accion();
                }}
              >
                Confirmar
              </button>
              <button className="btn btn-ghost" onClick={cerrarConfirmacion}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
