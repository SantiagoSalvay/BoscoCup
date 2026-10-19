import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EquipoRow, JugadorRow } from "@/lib/db-types";

interface Props {
  partidoId: string;
  equipoLocal: EquipoRow;
  jugadoresLocal: JugadorRow[];
  equipoVisitante: EquipoRow;
  jugadoresVisitante: JugadorRow[];
  onListo: () => void;
}

export function FormacionSetup({ partidoId, equipoLocal, jugadoresLocal, equipoVisitante, jugadoresVisitante, onListo }: Props) {
  const [titularesLocal, setTitularesLocal] = useState<Set<string>>(new Set());
  const [titularesVisitante, setTitularesVisitante] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function onConfirmar() {
    if (!supabase) return setError("Supabase no está configurado.");
    setGuardando(true);
    setError(null);

    const filas = [
      ...jugadoresLocal.map((j) => ({
        partido_id: partidoId,
        equipo_id: equipoLocal.id,
        jugador_id: j.id,
        titular: titularesLocal.has(j.id)
      })),
      ...jugadoresVisitante.map((j) => ({
        partido_id: partidoId,
        equipo_id: equipoVisitante.id,
        jugador_id: j.id,
        titular: titularesVisitante.has(j.id)
      }))
    ];

    const { error: err } = await supabase.from("formaciones").insert(filas);
    setGuardando(false);
    if (err) return setError(err.message);
    onListo();
  }

  const totalTitulares = titularesLocal.size + titularesVisitante.size;

  return (
    <div className="veedor-page">
      <div className="app-content" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 className="page-title">Formación inicial</h2>
        <p className="form-hint">Marcá los titulares de cada equipo antes de arrancar el partido.</p>

        {[
          { equipo: equipoLocal, jugadores: jugadoresLocal, titulares: titularesLocal, setter: (s: Set<string>) => setTitularesLocal(s) },
          { equipo: equipoVisitante, jugadores: jugadoresVisitante, titulares: titularesVisitante, setter: (s: Set<string>) => setTitularesVisitante(s) }
        ].map(({ equipo, jugadores, titulares, setter }) => (
          <div className="panel" key={equipo.id}>
            <h3 className="page-title" style={{ fontSize: 16, marginBottom: 10 }}>
              <span className="color-dot" style={{ background: equipo.color_primario }} />
              {equipo.nombre}
            </h3>
            {jugadores.length === 0 && <p className="form-hint">Este equipo no tiene jugadores cargados.</p>}
            <div className="lineup-grid">
              {jugadores.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  className={`lineup-chip ${titulares.has(j.id) ? "active" : ""}`}
                  onClick={() => toggle(titulares, setter, j.id)}
                >
                  <span className="tnum">{j.numero ?? "—"}</span> {j.nombre}
                </button>
              ))}
            </div>
          </div>
        ))}

        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={onConfirmar} disabled={guardando || totalTitulares === 0}>
          {guardando ? "Guardando…" : "Confirmar formación y empezar"}
        </button>
      </div>
    </div>
  );
}
