import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { EquipoRow, FormacionRow, JugadorRow, PartidoRow } from "@/lib/db-types";
import { FormacionSetup } from "@/pages/veedor/FormacionSetup";
import { PartidoEnVivo } from "@/pages/veedor/PartidoEnVivo";

export function PartidoRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [partido, setPartido] = useState<PartidoRow | null>(null);
  const [equipoLocal, setEquipoLocal] = useState<EquipoRow | null>(null);
  const [equipoVisitante, setEquipoVisitante] = useState<EquipoRow | null>(null);
  const [jugadoresLocal, setJugadoresLocal] = useState<JugadorRow[]>([]);
  const [jugadoresVisitante, setJugadoresVisitante] = useState<JugadorRow[]>([]);
  const [formaciones, setFormaciones] = useState<FormacionRow[] | null>(null);

  useEffect(() => {
    if (!supabase || !id) return;
    load();
  }, [id]);

  async function load() {
    if (!supabase || !id) return;
    const { data: p } = await supabase.from("partidos").select("*").eq("id", id).single();
    if (!p) return;
    setPartido(p as PartidoRow);

    const [local, visitante, formacionesRes] = await Promise.all([
      supabase.from("equipos").select("*").eq("id", p.equipo_local_id).single(),
      p.equipo_visitante_id ? supabase.from("equipos").select("*").eq("id", p.equipo_visitante_id).single() : Promise.resolve({ data: null }),
      supabase.from("formaciones").select("*").eq("partido_id", id)
    ]);
    setEquipoLocal((local.data as EquipoRow) ?? null);
    setEquipoVisitante((visitante.data as EquipoRow) ?? null);
    setFormaciones((formacionesRes.data as FormacionRow[]) ?? []);

    const [jl, jv] = await Promise.all([
      supabase.from("jugadores").select("*").eq("equipo_id", p.equipo_local_id).order("numero"),
      p.equipo_visitante_id
        ? supabase.from("jugadores").select("*").eq("equipo_id", p.equipo_visitante_id).order("numero")
        : Promise.resolve({ data: [] })
    ]);
    setJugadoresLocal((jl.data as JugadorRow[]) ?? []);
    setJugadoresVisitante((jv.data as JugadorRow[]) ?? []);
  }

  if (!partido || !equipoLocal || !equipoVisitante || formaciones === null) {
    return <div className="auth-loading">Cargando…</div>;
  }

  if (formaciones.length === 0 && partido.estado === "programado") {
    return (
      <FormacionSetup
        partidoId={partido.id}
        equipoLocal={equipoLocal}
        jugadoresLocal={jugadoresLocal}
        equipoVisitante={equipoVisitante}
        jugadoresVisitante={jugadoresVisitante}
        onListo={load}
      />
    );
  }

  if (partido.estado === "finalizado") {
    navigate("/veedor");
    return null;
  }

  const titularesLocal = new Set(formaciones.filter((f) => f.equipo_id === equipoLocal.id && f.titular).map((f) => f.jugador_id));
  const titularesVisitante = new Set(formaciones.filter((f) => f.equipo_id === equipoVisitante.id && f.titular).map((f) => f.jugador_id));

  return (
    <PartidoEnVivo
      partidoId={partido.id}
      equipoLocal={equipoLocal}
      equipoVisitante={equipoVisitante}
      jugadoresLocal={jugadoresLocal}
      jugadoresVisitante={jugadoresVisitante}
      titularesLocal={titularesLocal}
      titularesVisitante={titularesVisitante}
      estadoInicial={partido.estado}
    />
  );
}
