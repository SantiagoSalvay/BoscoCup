import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { Categoria, EquipoRow } from "@/lib/db-types";

function categoriaLabel(c: Categoria): string {
  const deporte = c.deporte[0].toUpperCase() + c.deporte.slice(1);
  return `${deporte} · ${c.rama}`;
}

export function AdminEquipos() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#2F55FF");
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

  async function loadEquipos(catId: string) {
    if (!supabase || !catId) return;
    const { data } = await supabase.from("equipos").select("*").eq("categoria_id", catId).order("nombre");
    setEquipos((data as EquipoRow[]) ?? []);
  }

  useEffect(() => {
    loadEquipos(categoriaId);
  }, [categoriaId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Supabase no está configurado.");
    const { error: err } = await supabase
      .from("equipos")
      .insert({ categoria_id: categoriaId, nombre, color_primario: color });
    if (err) return setError(err.message);
    setNombre("");
    loadEquipos(categoriaId);
  }

  async function onDelete(id: string) {
    if (!supabase) return;
    await supabase.from("equipos").delete().eq("id", id);
    loadEquipos(categoriaId);
  }

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
      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Delegado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((eq) => (
              <tr key={eq.id}>
                <td>
                  <span className="color-dot" style={{ background: eq.color_primario }} />
                  {eq.nombre}
                </td>
                <td>{eq.delegado_nombre ?? "—"}</td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(eq.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {equipos.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-row">
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
