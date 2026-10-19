import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Counts {
  equipos: number;
  jugadores: number;
  partidosHoy: number;
  enJuego: number;
  veedores: number;
}

export function AdminDashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const today = new Date().toISOString().slice(0, 10);

    Promise.all([
      supabase.from("equipos").select("id"),
      supabase.from("jugadores").select("id"),
      supabase
        .from("partidos")
        .select("id")
        .gte("fecha_hora_programada", `${today}T00:00:00`)
        .lte("fecha_hora_programada", `${today}T23:59:59`),
      supabase.from("partidos").select("id").eq("estado", "en_juego"),
      supabase.from("profiles").select("id").eq("rol", "veedor").eq("activo", true)
    ]).then(([equipos, jugadores, partidosHoy, enJuego, veedores]) => {
      setCounts({
        equipos: equipos.data?.length ?? 0,
        jugadores: jugadores.data?.length ?? 0,
        partidosHoy: partidosHoy.data?.length ?? 0,
        enJuego: enJuego.data?.length ?? 0,
        veedores: veedores.data?.length ?? 0
      });
    });
  }, []);

  return (
    <div>
      <h2 className="page-title">Resumen</h2>
      {!supabase && <p className="form-hint form-hint-warn">Conectá Supabase para ver datos reales acá.</p>}
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value tnum">{counts?.enJuego ?? "—"}</span>
          <span className="stat-label">En juego ahora</span>
        </div>
        <div className="stat-card">
          <span className="stat-value tnum">{counts?.partidosHoy ?? "—"}</span>
          <span className="stat-label">Partidos hoy</span>
        </div>
        <div className="stat-card">
          <span className="stat-value tnum">{counts?.equipos ?? "—"}</span>
          <span className="stat-label">Equipos cargados</span>
        </div>
        <div className="stat-card">
          <span className="stat-value tnum">{counts?.jugadores ?? "—"}</span>
          <span className="stat-label">Jugadores cargados</span>
        </div>
        <div className="stat-card">
          <span className="stat-value tnum">{counts?.veedores ?? "—"}</span>
          <span className="stat-label">Veedores activos</span>
        </div>
      </div>
    </div>
  );
}
