import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { PartidoRow } from "@/lib/db-types";

interface PartidoAsignado extends PartidoRow {
  local_nombre: string;
  visitante_nombre: string;
  cancha_nombre: string;
}

export function VeedorHome() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [partidos, setPartidos] = useState<PartidoAsignado[] | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    if (!supabase) return;
    const { data: asignaciones } = await supabase.from("asignaciones_veedor").select("partido_id");
    const partidoIds = (asignaciones ?? []).map((a: { partido_id: string }) => a.partido_id);
    if (partidoIds.length === 0) return setPartidos([]);

    const { data: partidosData } = await supabase.from("partidos").select("*").in("id", partidoIds);
    const rows = (partidosData as PartidoRow[]) ?? [];

    const { data: equiposData } = await supabase.from("equipos").select("id, nombre");
    const { data: canchasData } = await supabase.from("canchas").select("id, nombre");
    const equipoNombre = new Map((equiposData ?? []).map((e: { id: string; nombre: string }) => [e.id, e.nombre]));
    const canchaNombre = new Map((canchasData ?? []).map((c: { id: string; nombre: string }) => [c.id, c.nombre]));

    setPartidos(
      rows
        .map((p) => ({
          ...p,
          local_nombre: equipoNombre.get(p.equipo_local_id) ?? "—",
          visitante_nombre: p.equipo_visitante_id ? equipoNombre.get(p.equipo_visitante_id) ?? "—" : "—",
          cancha_nombre: p.cancha_id ? canchaNombre.get(p.cancha_id) ?? "—" : "Sin cancha"
        }))
        .sort((a, b) => (a.fecha_hora_programada ?? "").localeCompare(b.fecha_hora_programada ?? ""))
    );
  }

  async function onSignOut() {
    await signOut();
    navigate("/veedor/login");
  }

  return (
    <div className="veedor-page">
      <header className="topbar">
        <span className="badge-role">Veedor · {profile?.nombre}</span>
        <button className="btn btn-ghost" onClick={onSignOut}>
          Salir
        </button>
      </header>

      <main className="app-content">
        <h2 className="page-title">Mis partidos</h2>

        {partidos === null && <p className="form-hint">Cargando…</p>}
        {partidos?.length === 0 && (
          <p className="form-hint">Todavía no tenés partidos asignados. Avisale al organizador.</p>
        )}

        <div className="assigned-list">
          {partidos?.map((p) => (
            <button
              key={p.id}
              className="assigned-card"
              disabled={p.estado === "finalizado"}
              onClick={() => navigate(`/veedor/partido/${p.id}`)}
            >
              <span className="badge-estado">{p.estado}</span>
              <div className="assigned-teams">
                {p.local_nombre} vs. {p.visitante_nombre}
              </div>
              <div className="assigned-meta">
                {p.cancha_nombre}
                {p.fecha_hora_programada &&
                  ` · ${new Date(p.fecha_hora_programada).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}`}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
