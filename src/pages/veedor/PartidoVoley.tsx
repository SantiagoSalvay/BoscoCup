import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { EquipoRow, PartidoEstado } from "@/lib/db-types";

interface Props {
  partidoId: string;
  equipoLocal: EquipoRow;
  equipoVisitante: EquipoRow;
  estadoInicial: PartidoEstado;
}

interface SetVoley {
  numero: number;
  local: number;
  visitante: number;
  cerrado: boolean;
}

interface SetRow {
  numero_set: number;
  puntos_local: number;
  puntos_visitante: number;
  ganador_equipo_id: string | null;
}

/**
 * Carga en vivo de un partido de vóley: el veedor suma puntos al set en curso
 * y cierra cada set. Los sets ganados se guardan como resultado del partido,
 * así la tabla y el marcador público los ven sin cálculos extra.
 */
export function PartidoVoley({ partidoId, equipoLocal, equipoVisitante, estadoInicial }: Props) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<PartidoEstado>(estadoInicial);
  const [sets, setSets] = useState<SetVoley[]>([{ numero: 1, local: 0, visitante: 0, cerrado: false }]);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ mensaje: string; accion: () => void } | null>(null);
  const guardado = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("sets_voley")
      .select("numero_set, puntos_local, puntos_visitante, ganador_equipo_id")
      .eq("partido_id", partidoId)
      .order("numero_set")
      .then(({ data }) => {
        const rows = (data as SetRow[]) ?? [];
        if (rows.length === 0) return;
        const cargados = rows.map((r) => ({
          numero: r.numero_set,
          local: r.puntos_local,
          visitante: r.puntos_visitante,
          cerrado: Boolean(r.ganador_equipo_id)
        }));
        const ultimo = cargados[cargados.length - 1];
        if (ultimo.cerrado) cargados.push({ numero: ultimo.numero + 1, local: 0, visitante: 0, cerrado: false });
        setSets(cargados);
      });
  }, [partidoId]);

  const actual = sets[sets.length - 1];
  const setsLocal = sets.filter((s) => s.cerrado && s.local > s.visitante).length;
  const setsVisitante = sets.filter((s) => s.cerrado && s.visitante > s.local).length;
  const jugando = estado === "en_juego";

  async function guardarSet(set: SetVoley, ganadorId: string | null) {
    if (!supabase) return;
    const { error: err } = await supabase.from("sets_voley").upsert(
      {
        partido_id: partidoId,
        numero_set: set.numero,
        puntos_local: set.local,
        puntos_visitante: set.visitante,
        ganador_equipo_id: ganadorId
      },
      { onConflict: "partido_id,numero_set" }
    );
    setError(err ? `No se pudo guardar el set: ${err.message}` : null);
  }

  function sumar(lado: "local" | "visitante", delta: 1 | -1) {
    if (!jugando) return;
    const nuevo = { ...actual, [lado]: Math.max(0, actual[lado] + delta) };
    setSets([...sets.slice(0, -1), nuevo]);
    // Agrupa los toques rápidos en un solo guardado.
    if (guardado.current) clearTimeout(guardado.current);
    guardado.current = setTimeout(() => guardarSet(nuevo, null), 600);
  }

  async function cerrarSet() {
    if (actual.local === actual.visitante) return;
    if (guardado.current) clearTimeout(guardado.current);
    const ganador = actual.local > actual.visitante ? equipoLocal.id : equipoVisitante.id;
    const cerrado = { ...actual, cerrado: true };
    const nl = setsLocal + (ganador === equipoLocal.id ? 1 : 0);
    const nv = setsVisitante + (ganador === equipoVisitante.id ? 1 : 0);
    setSets([...sets.slice(0, -1), cerrado, { numero: actual.numero + 1, local: 0, visitante: 0, cerrado: false }]);
    await guardarSet(cerrado, ganador);
    if (supabase) {
      await supabase.from("partidos").update({ resultado_local: nl, resultado_visitante: nv }).eq("id", partidoId);
    }
  }

  async function cambiarEstado(nuevo: PartidoEstado, extra: Record<string, unknown> = {}) {
    setEstado(nuevo);
    if (!supabase) return;
    const { error: err } = await supabase.from("partidos").update({ estado: nuevo, ...extra }).eq("id", partidoId);
    if (err) setError(err.message);
  }

  async function finalizar() {
    await cambiarEstado("finalizado", { resultado_local: setsLocal, resultado_visitante: setsVisitante });
    navigate("/veedor");
  }

  return (
    <div className="veedor-page">
      <div className="v-live-top">
        <div className="v-score-row">
          <div className="v-team">
            <span className="color-dot" style={{ background: equipoLocal.color_primario }} />
            {equipoLocal.nombre}
          </div>
          <div className="v-score tnum" aria-label="Sets ganados">
            {setsLocal}
            <span>—</span>
            {setsVisitante}
          </div>
          <div className="v-team">
            <span className="color-dot" style={{ background: equipoVisitante.color_primario }} />
            {equipoVisitante.nombre}
          </div>
        </div>
        <div className="v-clock-row">
          <span className="v-clock">Set {actual.numero}</span>
          <span className="badge-estado">{estado.replace("_", " ")}</span>
        </div>
        <div className="v-clock-controls">
          {estado === "programado" && (
            <button className="btn btn-accent btn-sm" onClick={() => cambiarEstado("en_juego")}>
              Iniciar partido
            </button>
          )}
          {jugando && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={actual.local === actual.visitante}
              onClick={() =>
                setConfirmar({
                  mensaje: `¿Cerrar el set ${actual.numero} ${actual.local}-${actual.visitante}?`,
                  accion: cerrarSet
                })
              }
            >
              Cerrar set {actual.numero}
            </button>
          )}
          {jugando && setsLocal !== setsVisitante && actual.local === 0 && actual.visitante === 0 && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() =>
                setConfirmar({ mensaje: `¿Finalizar el partido ${setsLocal}-${setsVisitante} en sets?`, accion: finalizar })
              }
            >
              Finalizar partido
            </button>
          )}
        </div>
      </div>

      {error && <p className="form-error" style={{ padding: "0 16px" }}>{error}</p>}

      <div className="vy-court">
        {(
          [
            ["local", equipoLocal],
            ["visitante", equipoVisitante]
          ] as const
        ).map(([lado, eq]) => (
          <div className="vy-side" key={lado}>
            <button className="vy-point" style={{ background: eq.color_primario }} disabled={!jugando} onClick={() => sumar(lado, 1)}>
              <span className="vy-num tnum">{actual[lado]}</span>
              <span className="vy-label">+1 {eq.nombre}</span>
            </button>
            <button className="btn btn-ghost btn-sm" disabled={!jugando || actual[lado] === 0} onClick={() => sumar(lado, -1)}>
              Restar punto
            </button>
          </div>
        ))}
      </div>

      {sets.some((s) => s.cerrado) && (
        <div className="timeline">
          {sets
            .filter((s) => s.cerrado)
            .map((s) => (
              <div className="tl-item" key={s.numero}>
                <div className="minute">S{s.numero}</div>
                <div className="desc tnum">
                  <b>
                    {s.local} – {s.visitante}
                  </b>{" "}
                  · ganó {s.local > s.visitante ? equipoLocal.nombre : equipoVisitante.nombre}
                </div>
              </div>
            ))}
        </div>
      )}

      {confirmar && (
        <div className="sheet-overlay" onClick={() => setConfirmar(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">Confirmar</div>
            <p className="form-hint" style={{ margin: "0 0 14px" }}>
              {confirmar.mensaje}
            </p>
            <div className="sheet-options">
              <button
                className="btn btn-primary"
                onClick={() => {
                  confirmar.accion();
                  setConfirmar(null);
                }}
              >
                Confirmar
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmar(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
