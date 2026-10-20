import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { Categoria, EquipoRow, GrupoRow } from "@/lib/db-types";

function categoriaLabel(c: Categoria): string {
  const deporte = c.deporte[0].toUpperCase() + c.deporte.slice(1);
  return `${deporte} · ${c.rama}`;
}

/** Próximo nombre libre: "Grupo A", "Grupo B", … */
function siguienteNombreGrupo(grupos: GrupoRow[]): string {
  const usados = new Set(grupos.map((g) => g.nombre));
  for (let i = 0; i < 26; i++) {
    const nombre = `Grupo ${String.fromCharCode(65 + i)}`;
    if (!usados.has(nombre)) return nombre;
  }
  return `Grupo ${grupos.length + 1}`;
}

export function AdminEquipos() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [grupos, setGrupos] = useState<GrupoRow[]>([]);
  const [grupoDeEquipo, setGrupoDeEquipo] = useState<Map<string, string>>(new Map());
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#2F55FF");
  const [editando, setEditando] = useState<{ id: string; nombre: string; color: string } | null>(null);
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
  }, []);

  async function cargar(catId: string) {
    if (!supabase || !catId) return;
    const [{ data: eqData }, { data: grData }] = await Promise.all([
      supabase.from("equipos").select("*").eq("categoria_id", catId).order("nombre"),
      supabase.from("grupos").select("*").eq("categoria_id", catId).order("nombre")
    ]);
    const gs = (grData as GrupoRow[]) ?? [];
    setEquipos((eqData as EquipoRow[]) ?? []);
    setGrupos(gs);
    if (gs.length === 0) return setGrupoDeEquipo(new Map());
    const { data: geData } = await supabase
      .from("grupo_equipos")
      .select("*")
      .in(
        "grupo_id",
        gs.map((g) => g.id)
      );
    setGrupoDeEquipo(new Map(((geData as { grupo_id: string; equipo_id: string }[]) ?? []).map((x) => [x.equipo_id, x.grupo_id])));
  }

  useEffect(() => {
    setEditando(null);
    cargar(categoriaId);
  }, [categoriaId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Supabase no está configurado.");
    const { error: err } = await supabase.from("equipos").insert({ categoria_id: categoriaId, nombre, color_primario: color });
    if (err) return setError(err.message);
    setNombre("");
    cargar(categoriaId);
  }

  async function onGuardarEdicion() {
    if (!supabase || !editando) return;
    setError(null);
    const { error: err } = await supabase
      .from("equipos")
      .update({ nombre: editando.nombre, color_primario: editando.color })
      .eq("id", editando.id);
    if (err) return setError(err.message);
    setEditando(null);
    cargar(categoriaId);
  }

  async function onDelete(eq: EquipoRow) {
    if (!supabase) return;
    const ok = window.confirm(
      `¿Eliminar "${eq.nombre}"?\n\nSe borran también sus jugadores y todos los partidos que jugó o tiene programados. No se puede deshacer.`
    );
    if (!ok) return;
    setError(null);
    const { error: err } = await supabase.from("equipos").delete().eq("id", eq.id);
    if (err) return setError(`No se pudo eliminar: ${err.message}`);
    cargar(categoriaId);
  }

  async function onCrearGrupo() {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.from("grupos").insert({ categoria_id: categoriaId, nombre: siguienteNombreGrupo(grupos) });
    if (err) return setError(err.message);
    cargar(categoriaId);
  }

  async function onEliminarGrupo(g: GrupoRow) {
    if (!supabase) return;
    if (!window.confirm(`¿Eliminar ${g.nombre}? Los equipos quedan sin grupo (no se borran).`)) return;
    setError(null);
    const { error: err } = await supabase.from("grupos").delete().eq("id", g.id);
    if (err) return setError(err.message);
    cargar(categoriaId);
  }

  async function onAsignarGrupo(equipoId: string, grupoId: string) {
    if (!supabase) return;
    setError(null);
    if (grupos.length > 0) {
      const { error: delErr } = await supabase
        .from("grupo_equipos")
        .delete()
        .eq("equipo_id", equipoId)
        .in(
          "grupo_id",
          grupos.map((g) => g.id)
        );
      if (delErr) return setError(delErr.message);
    }
    if (grupoId) {
      const { error: err } = await supabase.from("grupo_equipos").insert({ grupo_id: grupoId, equipo_id: equipoId });
      if (err) return setError(err.message);
    }
    cargar(categoriaId);
  }

  const cantidadPorGrupo = (grupoId: string) => equipos.filter((e) => grupoDeEquipo.get(e.id) === grupoId).length;

  return (
    <div>
      <h2 className="page-title">Equipos</h2>

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
          <span>Nombre del equipo</span>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label className="field" style={{ maxWidth: 120 }}>
          <span>Color</span>
          <input className="input input-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={!categoriaId}>
          Agregar equipo
        </button>
      </form>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Grupos</h3>
            <p className="form-hint" style={{ margin: 0 }}>
              Dividí la categoría en grupos (por ejemplo uno por cancha). Cada grupo tiene su propia tabla y sus
              clasificados pasan a los cruces.
            </p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onCrearGrupo} disabled={!categoriaId}>
            + Agregar {siguienteNombreGrupo(grupos)}
          </button>
        </div>
        {grupos.length === 0 ? (
          <p className="form-hint" style={{ margin: "12px 0 0" }}>
            Sin grupos: todos los equipos juegan en una tabla única.
          </p>
        ) : (
          <div className="group-chips">
            {grupos.map((g) => (
              <span className="group-chip" key={g.id}>
                {g.nombre}
                <span className="group-chip-count tnum">{cantidadPorGrupo(g.id)}</span>
                <button type="button" aria-label={`Eliminar ${g.nombre}`} onClick={() => onEliminarGrupo(g)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Equipo</th>
              {grupos.length > 0 && <th>Grupo</th>}
              <th>Delegado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((eq) =>
              editando?.id === eq.id ? (
                <tr key={eq.id}>
                  <td colSpan={grupos.length > 0 ? 3 : 2}>
                    <div className="inline-edit">
                      <input
                        className="input input-sm input-color"
                        type="color"
                        value={editando.color}
                        onChange={(e) => setEditando({ ...editando, color: e.target.value })}
                        aria-label="Color"
                      />
                      <input
                        className="input input-sm"
                        value={editando.nombre}
                        onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                        aria-label="Nombre"
                        autoFocus
                      />
                    </div>
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-primary btn-sm" onClick={onGuardarEdicion} disabled={!editando.nombre.trim()}>
                      Guardar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={eq.id}>
                  <td>
                    <span className="color-dot" style={{ background: eq.color_primario }} />
                    {eq.nombre}
                  </td>
                  {grupos.length > 0 && (
                    <td>
                      <select
                        className="input input-sm"
                        value={grupoDeEquipo.get(eq.id) ?? ""}
                        onChange={(e) => onAsignarGrupo(eq.id, e.target.value)}
                      >
                        <option value="">Sin grupo</option>
                        {grupos.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td>{eq.delegado_nombre ?? "—"}</td>
                  <td className="row-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditando({ id: eq.id, nombre: eq.nombre, color: eq.color_primario })}
                    >
                      Editar
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(eq)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              )
            )}
            {equipos.length === 0 && (
              <tr>
                <td colSpan={grupos.length > 0 ? 4 : 3} className="empty-row">
                  Todavía no hay equipos en esta categoría.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
