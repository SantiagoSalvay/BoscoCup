import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { CanchaRow, Categoria, EquipoRow, PartidoRow, Profile } from "@/lib/db-types";

function categoriaLabel(c: Categoria): string {
  const deporte = c.deporte[0].toUpperCase() + c.deporte.slice(1);
  return `${deporte} · ${c.rama}`;
}

interface PartidoConNombres extends PartidoRow {
  local_nombre: string;
  visitante_nombre: string;
  cancha_nombre: string;
  veedor_id: string | null;
}

export function AdminPartidos() {
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

  async function onAsignarVeedor(partidoId: string, veedorId: string) {
    if (!supabase) return;
    if (!veedorId) {
      await supabase.from("asignaciones_veedor").delete().eq("partido_id", partidoId);
    } else {
      await supabase.from("asignaciones_veedor").upsert({ partido_id: partidoId, veedor_id: veedorId }, { onConflict: "partido_id" });
    }
    loadPartidos(categoriaId);
  }

  return (
    <div>
      <h2 className="page-title">Partidos</h2>
      <p className="form-hint">
        Carga manual por ahora — el auto-programador con detección de conflictos de horario/cancha es la
        próxima fase.
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
            {partidos.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.local_nombre} vs. {p.visitante_nombre}
                </td>
                <td>{p.cancha_nombre}</td>
                <td className="tnum">
                  {p.fecha_hora_programada
                    ? new Date(p.fecha_hora_programada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
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
            ))}
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
