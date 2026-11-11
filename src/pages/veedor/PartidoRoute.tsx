import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { DeporteDb, EquipoRow, JugadorRow, PartidoRow } from "@/lib/db-types";
import { PartidoEnVivo } from "@/pages/veedor/PartidoEnVivo";
import { PartidoVoley } from "@/pages/veedor/PartidoVoley";

export function PartidoRoute() {
  const { id } = useParams<{ id: string }>();

  const [partido, setPartido] = useState<PartidoRow | null>(null);
  const [deporte, setDeporte] = useState<DeporteDb | null>(null);
  const [equipoLocal, setEquipoLocal] = useState<EquipoRow | null>(null);
  const [equipoVisitante, setEquipoVisitante] = useState<EquipoRow | null>(null);
  const [jugadoresLocal, setJugadoresLocal] = useState<JugadorRow[]>([]);
  const [jugadoresVisitante, setJugadoresVisitante] = useState<JugadorRow[]>([]);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    if (!supabase || !id) return;
    load(id);
  }, [id]);

  async function load(partidoId: string) {
    if (!supabase) return;
    const { data: p } = await supabase.from("partidos").select("*").eq("id", partidoId).maybeSingle();
    if (!p) return setNoEncontrado(true);
    setPartido(p as PartidoRow);

    const [cat, local, visitante, jl, jv] = await Promise.all([
      supabase.from("categorias").select("deporte").eq("id", p.categoria_id).single(),
      supabase.from("equipos").select("*").eq("id", p.equipo_local_id).single(),
      p.equipo_visitante_id ? supabase.from("equipos").select("*").eq("id", p.equipo_visitante_id).single() : Promise.resolve({ data: null }),
      supabase.from("jugadores").select("*").eq("equipo_id", p.equipo_local_id).order("nombre"),
      p.equipo_visitante_id
        ? supabase.from("jugadores").select("*").eq("equipo_id", p.equipo_visitante_id).order("nombre")
        : Promise.resolve({ data: [] })
    ]);
    setDeporte(((cat.data as { deporte: DeporteDb } | null)?.deporte ?? "futbol") as DeporteDb);
    setEquipoLocal((local.data as EquipoRow) ?? null);
    setEquipoVisitante((visitante.data as EquipoRow) ?? null);
    setJugadoresLocal((jl.data as JugadorRow[]) ?? []);
    setJugadoresVisitante((jv.data as JugadorRow[]) ?? []);
  }

  if (noEncontrado) return <Navigate to="/veedor" replace />;
  if (!partido || !deporte || !equipoLocal || !equipoVisitante) {
    return <div className="auth-loading">Cargando…</div>;
  }
  if (partido.estado === "finalizado") return <Navigate to="/veedor" replace />;

  if (deporte === "voley") {
    return <PartidoVoley partidoId={partido.id} equipoLocal={equipoLocal} equipoVisitante={equipoVisitante} estadoInicial={partido.estado} />;
  }

  return (
    <PartidoEnVivo
      partidoId={partido.id}
      equipoLocal={equipoLocal}
      equipoVisitante={equipoVisitante}
      jugadoresLocal={jugadoresLocal}
      jugadoresVisitante={jugadoresVisitante}
      estadoInicial={partido.estado}
      esEliminatoria={Boolean(partido.ronda_eliminatoria)}
    />
  );
}
