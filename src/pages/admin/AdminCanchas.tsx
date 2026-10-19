import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { CanchaRow, DeporteDb } from "@/lib/db-types";

const TORNEO_ID = "00000000-0000-0000-0000-000000000001";
const DEPORTES: DeporteDb[] = ["futbol", "voley", "basquet"];

export function AdminCanchas() {
  const [canchas, setCanchas] = useState<CanchaRow[]>([]);
  const [nombre, setNombre] = useState("");
  const [deportes, setDeportes] = useState<DeporteDb[]>(["futbol"]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("canchas").select("*").order("nombre");
    setCanchas((data as CanchaRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleDeporte(d: DeporteDb) {
    setDeportes((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Supabase no está configurado.");
    if (deportes.length === 0) return setError("Elegí al menos un deporte.");

    const { error: err } = await supabase
      .from("canchas")
      .insert({ torneo_id: TORNEO_ID, nombre, deportes_compatibles: deportes });
    if (err) return setError(err.message);
    setNombre("");
    setDeportes(["futbol"]);
    load();
  }

  async function onDelete(id: string) {
    if (!supabase) return;
    await supabase.from("canchas").delete().eq("id", id);
    load();
  }

  async function onToggleEstado(c: CanchaRow) {
    if (!supabase) return;
    const estado = c.estado === "disponible" ? "fuera_de_servicio" : "disponible";
    await supabase.from("canchas").update({ estado }).eq("id", c.id);
    load();
  }

  return (
    <div>
      <h2 className="page-title">Canchas</h2>

      <form className="panel form-row" onSubmit={onSubmit}>
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <div className="field">
          <span>Deportes compatibles</span>
          <div className="chip-select">
            {DEPORTES.map((d) => (
              <button
                type="button"
                key={d}
                className={`chip-option ${deportes.includes(d) ? "active" : ""}`}
                onClick={() => toggleDeporte(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" type="submit">
          Agregar cancha
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Deportes</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {canchas.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td>{c.deportes_compatibles.join(", ")}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => onToggleEstado(c)}>
                    {c.estado === "disponible" ? "Disponible" : "Fuera de servicio"}
                  </button>
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(c.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {canchas.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  Todavía no hay canchas cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
