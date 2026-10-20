import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { CanchaRow, Categoria, EquipoRow, PartidoRow, Profile } from "@/lib/db-types";

function categoriaLabel(c: Categoria): string {
  const deporte = c.deporte[0].toUpperCase() + c.deporte.slice(1);
  return `${deporte} · ${c.rama}`;
}

const ROUND_ORDER = ["Octavos", "Cuartos", "Semifinal", "3er puesto", "Final"];

/** ISO -> valor de <input type="datetime-local"> en hora local ("2026-10-20T18:30"). */
function aInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function horarioCorto(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

/** Los cruces sin jugar son los únicos que se programan desde su propia fila. */
function esCruceEditable(p: PartidoRow): boolean {
  return Boolean(p.ronda_eliminatoria) && p.estado !== "finalizado";
}

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
  /** Horario que se está tipeando en una fila de cruce, antes de guardarlo. */
  const [horarioDraft, setHorarioDraft] = useState<Record<string, string>>({});

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
      return ra - rb || (a.fecha_hora_programada ?? "~").localeCompare(b.fecha_hora_programada ?? "~");
    });
    setHorarioDraft({});
    setPartidos(
      rows.map((p) => ({
        ...p,
        local_nombre: equipoNombre.get(p.equipo_local_id) ?? "—",
        visitante_nombre: p.equipo_visitante_id ? equipoNombre.get(p.equipo_visitante_id) ?? "—" : "—",
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
      fecha_hora_programada: horario ? new Date(horario).toISOString() : null
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

  /** Guarda cancha y/o horario de un cruce y avisa si choca con otro partido en la misma cancha. */
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

  function onHorarioCruce(p: PartidoConNombres) {
    const valor = horarioDraft[p.id];
    if (valor === undefined || valor === aInputLocal(p.fecha_hora_programada)) return;
    onProgramarCruce(p, { fecha_hora_programada: valor ? new Date(valor).toISOString() : null });
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
  const canchasCompatibles = canchas.filter((c) => !deporte || !c.deportes_compatibles?.length || c.deportes_compatibles.includes(deporte));

  return (
    <div>
      <h2 className="page-title">Partidos</h2>
      <p className="form-hint">
        Los partidos de fase de grupos se programan con el formulario. Los cruces se generan desde la sección
        Cruces y acá les elegís cancha y horario directamente en su fila.
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

      <form className="panel form-row" onSubmit={onSubmit}>
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
          <span>Horario</span>
          <input className="input" type="datetime-local" value={horario} onChange={(e) => setHorario(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          Programar partido
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {aviso && <p className="form-hint form-hint-warn">{aviso}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Partido</th>
              <th>Cancha</th>
              <th>Horario</th>
              <th>Estado</th>
              <th>Veedor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {partidos.map((p) => {
              const editable = esCruceEditable(p);
              const faltaProgramar = editable && (!p.cancha_id || !p.fecha_hora_programada);
              return (
              <tr key={p.id} className={faltaProgramar ? "row-pending" : ""}>
                <td>
                  {p.local_nombre} vs. {p.visitante_nombre}
                  {p.ronda_eliminatoria && <span className="round-tag">{p.ronda_eliminatoria}</span>}
                  {faltaProgramar && <span className="row-note">Falta {!p.cancha_id && !p.fecha_hora_programada ? "cancha y horario" : !p.cancha_id ? "cancha" : "horario"}</span>}
                </td>
                <td>
                  {editable ? (
                    <select
                      className="input input-sm"
                      value={p.cancha_id ?? ""}
                      onChange={(e) => onProgramarCruce(p, { cancha_id: e.target.value || null })}
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
                    p.cancha_nombre
                  )}
                </td>
                <td className="tnum">
                  {editable ? (
                    <input
                      className="input input-sm"
                      type="datetime-local"
                      value={horarioDraft[p.id] ?? aInputLocal(p.fecha_hora_programada)}
                      onChange={(e) => setHorarioDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                      onBlur={() => onHorarioCruce(p)}
                      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                      aria-label={`Horario de ${p.local_nombre} vs. ${p.visitante_nombre}`}
                    />
                  ) : (
                    horarioCorto(p.fecha_hora_programada)
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
