import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { cancelQueuedInsert, insertWithFallback, isQueued, updateWithFallback } from "@/lib/offline-queue";
import { useSyncStatus } from "@/lib/use-sync-status";
import { useMatchClock } from "@/lib/use-match-clock";
import type { EquipoRow, EventoPartidoRow, EventoTipo, JugadorRow, PartidoEstado } from "@/lib/db-types";
import {
  IconCard,
  IconGol,
  IconGoalOwn,
  IconIncidencia,
  IconPenal,
  IconSub,
  IconSync,
  IconUndo
} from "@/components/icons";

interface Props {
  partidoId: string;
  equipoLocal: EquipoRow;
  equipoVisitante: EquipoRow;
  jugadoresLocal: JugadorRow[];
  jugadoresVisitante: JugadorRow[];
  titularesLocal: Set<string>;
  titularesVisitante: Set<string>;
  estadoInicial: PartidoEstado;
  esEliminatoria: boolean;
}

type Step = "equipo" | "jugador" | "asistencia" | "sale" | "entra" | "texto";

interface SheetState {
  tipo: EventoTipo;
  step: Step;
  equipoId?: string;
  jugadorId?: string;
  saleId?: string;
}

const ACCIONES: { tipo: EventoTipo; label: string; icon: typeof IconGol; className: string }[] = [
  { tipo: "gol", label: "Gol", icon: IconGol, className: "gol" },
  { tipo: "tarjeta_amarilla", label: "Amarilla", icon: IconCard, className: "amarilla" },
  { tipo: "tarjeta_roja", label: "Roja", icon: IconCard, className: "roja" },
  { tipo: "cambio", label: "Cambio", icon: IconSub, className: "cambio" },
  { tipo: "penal_convertido", label: "Penal convertido", icon: IconPenal, className: "penal" },
  { tipo: "penal_errado", label: "Penal errado", icon: IconPenal, className: "incidencia" },
  { tipo: "gol_en_contra", label: "Gol en contra", icon: IconGoalOwn, className: "incidencia" },
  { tipo: "incidencia", label: "Incidencia", icon: IconIncidencia, className: "incidencia" }
];

export function PartidoEnVivo({
  partidoId,
  equipoLocal,
  equipoVisitante,
  jugadoresLocal,
  jugadoresVisitante,
  titularesLocal,
  titularesVisitante,
  estadoInicial,
  esEliminatoria
}: Props) {
  const navigate = useNavigate();
  const clock = useMatchClock(partidoId);
  const sync = useSyncStatus();

  const [estado, setEstado] = useState<PartidoEstado>(estadoInicial);
  const [eventos, setEventos] = useState<EventoPartidoRow[]>([]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [texto, setTexto] = useState("");
  const [confirmState, setConfirmState] = useState<{ mensaje: string; accion: () => void } | null>(null);
  const [penalesAbierto, setPenalesAbierto] = useState(false);
  const [penalesLocal, setPenalesLocal] = useState(0);
  const [penalesVisitante, setPenalesVisitante] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("eventos_partido")
      .select("*")
      .eq("partido_id", partidoId)
      .order("creado_en", { ascending: true })
      .then(({ data }) => setEventos((data as EventoPartidoRow[]) ?? []));
  }, [partidoId]);

  const [otroDispositivo, setOtroDispositivo] = useState(false);

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

  function enCancha(equipoId: string, titulares: Set<string>): string[] {
    const onField = new Set(titulares);
    for (const e of eventos) {
      if (e.anulado || e.equipo_id !== equipoId) continue;
      if (e.tipo === "cambio") {
        const { entra_id, sale_id } = (e.detalle ?? {}) as { entra_id?: string; sale_id?: string };
        if (sale_id) onField.delete(sale_id);
        if (entra_id) onField.add(entra_id);
      }
    }
    for (const id of expulsados) onField.delete(id);
    return [...onField];
  }

  function jugadoresDe(equipoId: string): JugadorRow[] {
    return equipoId === equipoLocal.id ? jugadoresLocal : jugadoresVisitante;
  }

  function openSheet(tipo: EventoTipo) {
    setTexto("");
    setSheet({ tipo, step: "equipo" });
  }
  function closeSheet() {
    setSheet(null);
  }

  async function confirmarEvento(payload: { equipoId: string | null; jugadorId: string | null; asistenciaId?: string | null; saleId?: string; entraId?: string; texto?: string }) {
    if (!sheet) return;
    let tipo: EventoTipo = sheet.tipo;

    if (tipo === "tarjeta_amarilla" && payload.jugadorId && (amarillasPorJugador.get(payload.jugadorId) ?? 0) >= 1) {
      tipo = "doble_amarilla";
    }

    const id = crypto.randomUUID();
    const detalle: Record<string, unknown> = {};
    if (payload.asistenciaId) detalle.asistencia_id = payload.asistenciaId;
    if (tipo === "cambio") {
      detalle.sale_id = payload.saleId;
      detalle.entra_id = payload.entraId;
    }
    if (payload.texto) detalle.texto = payload.texto;

    const row: EventoPartidoRow = {
      id,
      partido_id: partidoId,
      tipo,
      equipo_id: payload.equipoId,
      jugador_id: tipo === "cambio" ? payload.entraId ?? null : payload.jugadorId,
      jugador_asistencia_id: payload.asistenciaId ?? null,
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
      jugador_asistencia_id: payload.asistenciaId ?? null,
      minuto: clock.minuto,
      detalle
    });
    sync.refresh();
  }

  function deshacer() {
    const ultimo = [...eventos].filter((e) => !e.anulado).at(-1);
    if (!ultimo) return;
    setConfirmState({
      mensaje: `¿Deshacer "${ultimo.tipo.replace(/_/g, " ")}"?`,
      accion: () => aplicarDeshacer(ultimo)
    });
  }

  async function aplicarDeshacer(ultimo: EventoPartidoRow) {
    setEventos((prev) => prev.map((e) => (e.id === ultimo.id ? { ...e, anulado: true } : e)));

    if (isQueued(ultimo.id)) {
      cancelQueuedInsert(ultimo.id);
    } else {
      await updateWithFallback("eventos_partido", ultimo.id, { anulado: true });
    }
    sync.refresh();
  }

  async function cambiarEstado(nuevo: PartidoEstado) {
    setEstado(nuevo);
    if (!supabase) return;
    await supabase.from("partidos").update({ estado: nuevo }).eq("id", partidoId);
  }

  function finalizarPartido() {
    setConfirmState({
      mensaje: `¿Finalizar el partido ${score.local}-${score.visitante}? No se va a poder seguir cargando eventos.`,
      accion: aplicarFinalizar
    });
  }

  async function aplicarFinalizar() {
    clock.detener();
    setEstado("finalizado");
    if (!supabase) return;
    await supabase
      .from("partidos")
      .update({ estado: "finalizado", resultado_local: score.local, resultado_visitante: score.visitante })
      .eq("id", partidoId);
    navigate("/veedor");
  }

  const empatadoEnEliminatoria = esEliminatoria && score.local === score.visitante;

  async function confirmarPenales() {
    if (penalesLocal === penalesVisitante) return;
    clock.detener();
    setEstado("finalizado");
    setPenalesAbierto(false);
    if (!supabase) return;
    await supabase
      .from("partidos")
      .update({
        estado: "finalizado",
        resultado_local: score.local,
        resultado_visitante: score.visitante,
        penales_local: penalesLocal,
        penales_visitante: penalesVisitante
      })
      .eq("id", partidoId);
    navigate("/veedor");
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

        <div className="v-score-row">
          <div className="v-team">
            <span className="color-dot" style={{ background: equipoLocal.color_primario }} />
            {equipoLocal.nombre}
          </div>
          <div className="v-score tnum">
            {score.local}
            <span>—</span>
            {score.visitante}
          </div>
          <div className="v-team">
            <span className="color-dot" style={{ background: equipoVisitante.color_primario }} />
            {equipoVisitante.nombre}
          </div>
        </div>

        <div className="v-clock-row">
          <span className="v-clock tnum">{clock.label}</span>
          <span className="badge-estado">{estado.replace("_", " ")}</span>
        </div>

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
          {estado === "en_juego" && empatadoEnEliminatoria && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setPenalesLocal(0);
                setPenalesVisitante(0);
                setPenalesAbierto(true);
              }}
            >
              Cargar penales
            </button>
          )}
          {estado === "en_juego" && !empatadoEnEliminatoria && (
            <button className="btn btn-danger btn-sm" onClick={finalizarPartido}>Finalizar partido</button>
          )}
        </div>
      </div>

      <div className="v-grid">
        {ACCIONES.map((a) => (
          <button key={a.tipo} className={`v-btn ${a.className}`} onClick={() => openSheet(a.tipo)} disabled={estado === "finalizado"}>
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
                <b>{e.tipo.replace(/_/g, " ")}</b>
                {e.jugador_id && ` — ${jugadorMap.get(e.jugador_id)?.nombre ?? ""}`}
                {(e.detalle as { texto?: string })?.texto && <div className="assist">{(e.detalle as { texto?: string }).texto}</div>}
              </div>
            </div>
          ))}
        {eventos.filter((e) => !e.anulado).length === 0 && <p className="form-hint">Todavía no hay eventos cargados.</p>}
      </div>

      {sheet && (
        <div className="sheet-overlay" onClick={closeSheet}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">{ACCIONES.find((a) => a.tipo === sheet.tipo)?.label}</div>

            {sheet.step === "equipo" && (
              <div className="sheet-options">
                <button className="sheet-option" onClick={() => setSheet({ ...sheet, equipoId: equipoLocal.id, step: sheet.tipo === "incidencia" ? "texto" : sheet.tipo === "cambio" ? "sale" : "jugador" })}>
                  <span className="color-dot" style={{ background: equipoLocal.color_primario }} />
                  {equipoLocal.nombre}
                </button>
                <button className="sheet-option" onClick={() => setSheet({ ...sheet, equipoId: equipoVisitante.id, step: sheet.tipo === "incidencia" ? "texto" : sheet.tipo === "cambio" ? "sale" : "jugador" })}>
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
                {jugadoresDe(equipoSel.id).map((j) => (
                  <button
                    key={j.id}
                    className={`sheet-option ${expulsados.has(j.id) ? "disabled-look" : ""}`}
                    onClick={() => {
                      if (sheet.tipo === "gol") setSheet({ ...sheet, jugadorId: j.id, step: "asistencia" });
                      else confirmarEvento({ equipoId: sheet.equipoId ?? null, jugadorId: j.id });
                    }}
                  >
                    <span className="tnum">{j.numero ?? "—"}</span> {j.nombre}
                    {expulsados.has(j.id) && " (expulsado)"}
                  </button>
                ))}
              </div>
            )}

            {sheet.step === "asistencia" && equipoSel && (
              <div className="sheet-options">
                <button className="sheet-option" onClick={() => confirmarEvento({ equipoId: sheet.equipoId ?? null, jugadorId: sheet.jugadorId ?? null })}>
                  Sin asistencia
                </button>
                {jugadoresDe(equipoSel.id)
                  .filter((j) => j.id !== sheet.jugadorId)
                  .map((j) => (
                    <button key={j.id} className="sheet-option" onClick={() => confirmarEvento({ equipoId: sheet.equipoId ?? null, jugadorId: sheet.jugadorId ?? null, asistenciaId: j.id })}>
                      <span className="tnum">{j.numero ?? "—"}</span> {j.nombre}
                    </button>
                  ))}
              </div>
            )}

            {sheet.step === "sale" && equipoSel && (
              <div className="sheet-options">
                {enCancha(equipoSel.id, equipoSel.id === equipoLocal.id ? titularesLocal : titularesVisitante).map((id) => {
                  const j = jugadorMap.get(id);
                  if (!j) return null;
                  return (
                    <button key={id} className="sheet-option" onClick={() => setSheet({ ...sheet, saleId: id, step: "entra" })}>
                      <span className="tnum">{j.numero ?? "—"}</span> {j.nombre}
                    </button>
                  );
                })}
              </div>
            )}

            {sheet.step === "entra" && equipoSel && sheet.saleId && (
              <div className="sheet-options">
                {jugadoresDe(equipoSel.id)
                  .filter((j) => !enCancha(equipoSel.id, equipoSel.id === equipoLocal.id ? titularesLocal : titularesVisitante).includes(j.id) && !expulsados.has(j.id))
                  .map((j) => (
                    <button key={j.id} className="sheet-option" onClick={() => confirmarEvento({ equipoId: sheet.equipoId ?? null, jugadorId: null, saleId: sheet.saleId, entraId: j.id })}>
                      <span className="tnum">{j.numero ?? "—"}</span> {j.nombre}
                    </button>
                  ))}
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

      {penalesAbierto && (
        <div className="sheet-overlay" onClick={() => setPenalesAbierto(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">Cargar penales</div>
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", margin: "4px 0 18px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{equipoLocal.nombre}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPenalesLocal((v) => Math.max(0, v - 1))}>
                    −
                  </button>
                  <span className="v-score tnum" style={{ fontSize: 28 }}>
                    {penalesLocal}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPenalesLocal((v) => v + 1)}>
                    +
                  </button>
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{equipoVisitante.nombre}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPenalesVisitante((v) => Math.max(0, v - 1))}>
                    −
                  </button>
                  <span className="v-score tnum" style={{ fontSize: 28 }}>
                    {penalesVisitante}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPenalesVisitante((v) => v + 1)}>
                    +
                  </button>
                </div>
              </div>
            </div>
            {penalesLocal === penalesVisitante && <p className="form-hint form-hint-warn">Los penales no pueden terminar empatados.</p>}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={penalesLocal === penalesVisitante} onClick={confirmarPenales}>
              Finalizar {penalesLocal}-{penalesVisitante} por penales
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 10, width: "100%" }} onClick={() => setPenalesAbierto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmState && (
        <div className="sheet-overlay" onClick={() => setConfirmState(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">Confirmar</div>
            <p className="form-hint" style={{ margin: "0 0 14px" }}>
              {confirmState.mensaje}
            </p>
            <div className="sheet-options">
              <button
                className="btn btn-primary"
                onClick={() => {
                  confirmState.accion();
                  setConfirmState(null);
                }}
              >
                Confirmar
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmState(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
