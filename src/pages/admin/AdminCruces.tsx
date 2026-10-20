import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { computeZonesForCategoria, type ZonasCategoria } from "@/lib/standings";
import { generarCruces } from "@/lib/bracket";
import type { Categoria, EquipoRow, PartidoRow } from "@/lib/db-types";
import { Shield } from "@/components/icons";

function categoriaLabel(c: Categoria): string {
  const deporte = c.deporte[0].toUpperCase() + c.deporte.slice(1);
  return `${deporte} · ${c.rama}`;
}

interface CruceRow {
  id: string;
  round: string;
  home: string;
  away: string;
  homeColor: string;
  awayColor: string;
  homeScore: number | null;
  awayScore: number | null;
  penalesHome: number | null;
  penalesVisitante: number | null;
  estado: string;
}

const ROUND_ORDER = ["Octavos", "Cuartos", "Semifinal", "3er puesto", "Final"];

export function AdminCruces() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [zonas, setZonas] = useState<ZonasCategoria | null>(null);
  const [cruces, setCruces] = useState<CruceRow[]>([]);
  const [clasificanSinGrupos, setClasificanSinGrupos] = useState(4);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("categorias")
      .select("*")
      .order("deporte")
      .then(({ data }) => {
        const list = (data as Categoria[]) ?? [];
        setCategorias(list);
        if (list.length > 0) setCategoriaId(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (categoriaId) cargar(categoriaId);
  }, [categoriaId]);

  async function cargar(catId: string) {
    if (!supabase || !catId) return;
    const cat = categorias.find((c) => c.id === catId);
    if (!cat) return;
    setMensaje(null);

    const zonasData = await computeZonesForCategoria(cat);
    setZonas(zonasData);

    const equipoNombre = new Map(zonasData.equipos.map((e: EquipoRow) => [e.id, e.nombre]));
    const equipoColor = new Map(zonasData.equipos.map((e: EquipoRow) => [e.id, e.color_primario]));
    const rows: CruceRow[] = zonasData.partidos
      .filter((p: PartidoRow) => p.ronda_eliminatoria)
      .sort((a: PartidoRow, b: PartidoRow) => ROUND_ORDER.indexOf(a.ronda_eliminatoria as string) - ROUND_ORDER.indexOf(b.ronda_eliminatoria as string))
      .map((p: PartidoRow) => ({
        id: p.id,
        round: p.ronda_eliminatoria as string,
        home: equipoNombre.get(p.equipo_local_id) ?? "—",
        away: p.equipo_visitante_id ? equipoNombre.get(p.equipo_visitante_id) ?? "—" : "—",
        homeColor: equipoColor.get(p.equipo_local_id) ?? "#999",
        awayColor: p.equipo_visitante_id ? equipoColor.get(p.equipo_visitante_id) ?? "#999" : "#999",
        homeScore: p.resultado_local,
        awayScore: p.resultado_visitante,
        penalesHome: p.penales_local,
        penalesVisitante: p.penales_visitante,
        estado: p.estado
      }));
    setCruces(rows);
  }

  async function onGenerar() {
    if (!categoriaId) return;
    setCargando(true);
    setMensaje(null);
    const resultado = await generarCruces(categoriaId, clasificanSinGrupos);
    setMensaje({ ok: resultado.ok, texto: resultado.mensaje });
    setCargando(false);
    if (resultado.ok) cargar(categoriaId);
  }

  const categoria = categorias.find((c) => c.id === categoriaId);
  const hayGrupos = (zonas?.zones.length ?? 0) > 1;
  const hayEliminatoria = cruces.length > 0;
  const etiquetaBoton = hayEliminatoria ? "Generar siguiente ronda" : "Generar cruces desde la tabla";

  return (
    <div>
      <h2 className="page-title">Cruces</h2>
      <p className="form-hint">
        Arma automáticamente la fase eliminatoria a partir de los clasificados de la tabla. Primero tenés que
        terminar todos los partidos de fase de grupos de la categoría.
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

      {zonas && (
        <div className="panel">
          <h3 style={{ margin: "0 0 14px", fontSize: 14 }}>Tabla actual</h3>
          {zonas.zones.every((z) => z.rows.length === 0) ? (
            <p className="form-hint" style={{ margin: 0 }}>
              Todavía no hay partidos de fase de grupos jugados.
            </p>
          ) : (
            zonas.zones.map((zone) => (
              <div key={zone.id} style={{ marginBottom: 14 }}>
                {zone.nombre && <div className="bracket-round">{zone.nombre}</div>}
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Equipo</th>
                        <th>PJ</th>
                        <th>DG</th>
                        <th>TA</th>
                        <th>TR</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zone.rows.map((row) => (
                        <tr key={row.team.id}>
                          <td>
                            <span className="color-dot" style={{ background: row.team.shieldColor }} />
                            {row.team.name}
                            {row.qualifies && " ★"}
                          </td>
                          <td>{row.played}</td>
                          <td>{row.goalDiff}</td>
                          <td>{row.amarillas}</td>
                          <td>{row.rojas}</td>
                          <td>{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {zone.rows.some((r) => r.empatado) && (
                  <p className="form-hint form-hint-warn" style={{ margin: "6px 0 0" }}>
                    Empate total entre {zone.rows.filter((r) => r.empatado).map((r) => r.team.name).join(" y ")} — hace falta
                    un partido de desempate antes de poder clasificar con certeza.
                  </p>
                )}
              </div>
            ))
          )}

          {!hayGrupos && !hayEliminatoria && (
            <label className="field" style={{ maxWidth: 220, marginTop: 14 }}>
              <span>Equipos que avanzan a playoffs</span>
              <input
                className="input"
                type="number"
                min={2}
                step={2}
                value={clasificanSinGrupos}
                onChange={(e) => setClasificanSinGrupos(Number(e.target.value) || 2)}
              />
            </label>
          )}

          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onGenerar} disabled={cargando || !categoria}>
            {cargando ? "Generando…" : etiquetaBoton}
          </button>
          {mensaje && <p className={mensaje.ok ? "form-success" : "form-error"}>{mensaje.texto}</p>}
          {mensaje?.ok && (
            <p className="form-hint" style={{ margin: 0 }}>
              Los cruces nuevos quedan sin cancha ni horario.{" "}
              <Link to={`/admin/partidos?categoria=${categoriaId}`}>Asignalos en Partidos →</Link>
            </p>
          )}
        </div>
      )}

      <div className="panel">
        <h3 style={{ margin: "0 0 14px", fontSize: 14 }}>Cruces generados</h3>
        {cruces.length === 0 && <p className="form-hint" style={{ margin: 0 }}>Todavía no hay cruces para esta categoría.</p>}
        {cruces.map((m, i) => (
          <div key={m.id}>
            {(i === 0 || cruces[i - 1].round !== m.round) && <div className="bracket-round">{m.round}</div>}
            <div className="match-pill">
              <span className="side">
                <Shield className="mini-shield" style={{ width: 12, height: 14 }} fill={m.homeColor} />
                {m.home}
              </span>
              <span className="sc tnum">
                {m.estado === "finalizado"
                  ? `${m.homeScore} - ${m.awayScore}${m.penalesHome !== null ? ` (${m.penalesHome}-${m.penalesVisitante} p.)` : ""}`
                  : m.estado.replace("_", " ")}
              </span>
              <span className="side">
                <Shield className="mini-shield" style={{ width: 12, height: 14 }} fill={m.awayColor} />
                {m.away}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
