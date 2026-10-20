import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { Categoria, EquipoRow, JugadorRow } from "@/lib/db-types";

function categoriaLabel(c: Categoria): string {
  const deporte = c.deporte[0].toUpperCase() + c.deporte.slice(1);
  return `${deporte} · ${c.rama}`;
}

export function AdminJugadores() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [equipos, setEquipos] = useState<EquipoRow[]>([]);
  const [equipoId, setEquipoId] = useState("");
  const [jugadores, setJugadores] = useState<JugadorRow[]>([]);

  const [nombre, setNombre] = useState("");
  const [numero, setNumero] = useState("");
  const [posicion, setPosicion] = useState("");
  const [editando, setEditando] = useState<{ id: string; nombre: string; numero: string; posicion: string } | null>(null);
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

  useEffect(() => {
    if (!supabase || !categoriaId) return;
    supabase
      .from("equipos")
      .select("*")
      .eq("categoria_id", categoriaId)
      .order("nombre")
      .then(({ data }) => {
        const list = (data as EquipoRow[]) ?? [];
        setEquipos(list);
        setEquipoId(list.length > 0 ? list[0].id : "");
      });
  }, [categoriaId]);

  async function loadJugadores(eqId: string) {
    if (!supabase || !eqId) return setJugadores([]);
    const { data } = await supabase.from("jugadores").select("*").eq("equipo_id", eqId).order("numero");
    setJugadores((data as JugadorRow[]) ?? []);
  }

  useEffect(() => {
    setEditando(null);
    loadJugadores(equipoId);
  }, [equipoId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Supabase no está configurado.");
    if (!equipoId) return setError("Elegí un equipo primero.");
    const { error: err } = await supabase.from("jugadores").insert({
      equipo_id: equipoId,
      nombre,
      numero: numero ? Number(numero) : null,
      posicion: posicion || null
    });
    if (err) return setError(err.message);
    setNombre("");
    setNumero("");
    setPosicion("");
    loadJugadores(equipoId);
  }

  async function onGuardarEdicion() {
    if (!supabase || !editando) return;
    setError(null);
    const { error: err } = await supabase
      .from("jugadores")
      .update({
        nombre: editando.nombre,
        numero: editando.numero ? Number(editando.numero) : null,
        posicion: editando.posicion || null
      })
      .eq("id", editando.id);
    if (err) {
      return setError(err.code === "23505" ? `Ya hay otro jugador con el número ${editando.numero} en este equipo.` : err.message);
    }
    setEditando(null);
    loadJugadores(equipoId);
  }

  async function onDelete(j: JugadorRow) {
    if (!supabase) return;
    const ok = window.confirm(
      `¿Eliminar a ${j.nombre}?\n\nSus goles y tarjetas ya cargados se conservan en los resultados, pero sin nombre. No se puede deshacer.`
    );
    if (!ok) return;
    setError(null);
    const { error: err } = await supabase.from("jugadores").delete().eq("id", j.id);
    if (err) return setError(`No se pudo eliminar: ${err.message}`);
    loadJugadores(equipoId);
  }

  return (
    <div>
      <h2 className="page-title">Jugadores</h2>

      <div className="form-row" style={{ marginBottom: 20 }}>
        <label className="field">
          <span>Categoría</span>
          <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {categoriaLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Equipo</span>
          <select className="input" value={equipoId} onChange={(e) => setEquipoId(e.target.value)}>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form className="panel form-row" onSubmit={onSubmit}>
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label className="field" style={{ maxWidth: 100 }}>
          <span>Número</span>
          <input className="input" inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="field" style={{ maxWidth: 160 }}>
          <span>Posición</span>
          <input className="input" value={posicion} onChange={(e) => setPosicion(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={!equipoId}>
          Agregar jugador
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Posición</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jugadores.map((j) =>
              editando?.id === j.id ? (
                <tr key={j.id}>
                  <td style={{ width: 80 }}>
                    <input
                      className="input input-sm"
                      inputMode="numeric"
                      value={editando.numero}
                      onChange={(e) => setEditando({ ...editando, numero: e.target.value.replace(/\D/g, "") })}
                      aria-label="Número"
                    />
                  </td>
                  <td>
                    <input
                      className="input input-sm"
                      value={editando.nombre}
                      onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                      aria-label="Nombre"
                      autoFocus
                    />
                  </td>
                  <td>
                    <input
                      className="input input-sm"
                      value={editando.posicion}
                      onChange={(e) => setEditando({ ...editando, posicion: e.target.value })}
                      aria-label="Posición"
                    />
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
                <tr key={j.id}>
                  <td className="tnum">{j.numero ?? "—"}</td>
                  <td>{j.nombre}</td>
                  <td>{j.posicion ?? "—"}</td>
                  <td className="row-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setEditando({ id: j.id, nombre: j.nombre, numero: j.numero?.toString() ?? "", posicion: j.posicion ?? "" })
                      }
                    >
                      Editar
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(j)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              )
            )}
            {jugadores.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  Todavía no hay jugadores en este equipo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
