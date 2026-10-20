import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Branch, Sport, Team } from "@/types";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchTeamDetail, type TeamDetail, type TeamMatch } from "@/lib/team-detail";
import { getMockTeamDetail } from "@/lib/mock-data";
import { Segmented } from "@/components/Segmented";
import { Shield } from "@/components/icons";

export interface TeamRef {
  team: Team;
  sport: Sport;
  branch: Branch;
}

type Vista = "resumen" | "partidos" | "plantel";

const PUNTOS_LABEL: Record<Sport, { a: string; c: string; anota: string }> = {
  futbol: { a: "GF", c: "GC", anota: "Goles" },
  voley: { a: "SF", c: "SC", anota: "Puntos" },
  basquet: { a: "PF", c: "PC", anota: "Puntos" }
};

const RESULTADO_TEXTO = { G: "Ganó", E: "Empató", P: "Perdió" } as const;

function Marcador({ m }: { m: TeamMatch }) {
  if (m.status === "programado") return <span className="ts-when">{m.when || "A definir"}</span>;
  const penales = m.penalesFor !== null && m.penalesAgainst !== null;
  return (
    <span className={`ts-score tnum ${m.status === "en_vivo" ? "live" : ""}`}>
      {m.goalsFor}
      <i>–</i>
      {m.goalsAgainst}
      {penales && (
        <small>
          ({m.penalesFor}-{m.penalesAgainst} p.)
        </small>
      )}
    </span>
  );
}

/** Hoja con todo lo de un equipo: posición, números, racha, partidos y plantel. */
export function TeamSheet({ target, onClose }: { target: TeamRef | null; onClose: () => void }) {
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState<Vista>("resumen");
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!target) return;
    let active = true;
    setVista("resumen");
    setDetail(null);
    setLoading(true);
    requestAnimationFrame(() => setOpen(true));
    const load = isSupabaseConfigured
      ? fetchTeamDetail(target.team.id)
      : Promise.resolve(getMockTeamDetail(target.team.id, target.sport, target.branch));
    load.then((d) => {
      if (!active) return;
      setDetail(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [target]);

  function cerrar() {
    setOpen(false);
    setDrag(0);
    window.setTimeout(onClose, 260);
  }

  function onPointerDown(e: ReactPointerEvent) {
    dragStart.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (dragStart.current === null) return;
    setDrag(Math.max(0, e.clientY - dragStart.current));
  }
  function onPointerUp() {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (drag > 110) cerrar();
    else setDrag(0);
  }

  if (!target) return null;

  const team = detail?.team ?? target.team;
  const s = detail?.standing;
  const labels = PUNTOS_LABEL[detail?.sport ?? target.sport];
  const proximo = detail?.matches.find((m) => m.status !== "finalizado");

  return (
    <div className={`ts-overlay ${open ? "open" : ""}`} onClick={cerrar}>
      <div
        className="ts-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${team.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{ "--team": team.shieldColor, ...(drag ? { transform: `translateY(${drag}px)`, transition: "none" } : {}) } as React.CSSProperties}
      >
        <div className="ts-grab" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className="ts-handle" />
        </div>

        <header className="ts-head">
          <Shield className="ts-shield" fill={team.shieldColor} />
          <div className="ts-title">
            <h2>{team.name}</h2>
            <p>
              {detail?.categoriaLabel ?? " "}
              {detail?.zoneName && ` · ${detail.zoneName}`}
            </p>
          </div>
          <button type="button" className="ts-close" aria-label="Cerrar" onClick={cerrar} ref={closeBtn}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="ts-tabs">
          <Segmented
            label="Secciones del equipo"
            size="sm"
            value={vista}
            onChange={setVista}
            options={[
              { id: "resumen", label: "Resumen" },
              { id: "partidos", label: "Partidos" },
              { id: "plantel", label: "Plantel" }
            ]}
          />
        </div>

        <div className="ts-body">
          {loading ? (
            <div className="ts-skeleton" aria-label="Cargando">
              <span />
              <span />
              <span />
            </div>
          ) : !detail ? (
            <p className="empty-note">No encontramos los datos de este equipo.</p>
          ) : vista === "resumen" ? (
            <>
              {s && (
                <div className="ts-pos">
                  <div className="ts-pos-num">
                    {s.played > 0 ? s.position : "–"}
                    <sup>º</sup>
                  </div>
                  <div className="ts-pos-text">
                    <strong>{s.played > 0 ? `Puesto ${s.position} de ${detail.zoneSize}` : "Todavía sin jugar"}</strong>
                    <span>{detail.zoneName || "Tabla general"}</span>
                  </div>
                  <div className="ts-pos-pts">
                    <b className="tnum">{s.points}</b>
                    <span>pts</span>
                  </div>
                </div>
              )}

              {s && (
                <div className="ts-stats">
                  {[
                    ["PJ", s.played],
                    ["G", s.won],
                    ["E", s.drawn],
                    ["P", s.lost],
                    [labels.a, s.goalsFor],
                    [labels.c, s.goalsAgainst],
                    ["Dif.", `${s.goalDiff > 0 ? "+" : ""}${s.goalDiff}`],
                    ["Tarjetas", null]
                  ].map(([k, v]) =>
                    k === "Tarjetas" ? (
                      <div className="ts-stat" key={k}>
                        <span className="ts-cards">
                          <i className="tcard y" />
                          <b className="tnum">{s.amarillas}</b>
                          <i className="tcard r" />
                          <b className="tnum">{s.rojas}</b>
                        </span>
                        <span className="ts-stat-k">Tarjetas</span>
                      </div>
                    ) : (
                      <div className="ts-stat" key={k as string}>
                        <b className="tnum">{v}</b>
                        <span className="ts-stat-k">{k}</span>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="ts-section">
                <h3>Últimos resultados</h3>
                {detail.form.length === 0 ? (
                  <p className="empty-note">Sin partidos terminados todavía.</p>
                ) : (
                  <div className="ts-form">
                    {detail.form.map((r, i) => (
                      <span key={i} className={`ts-form-dot ${r}`} title={RESULTADO_TEXTO[r]}>
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {proximo && (
                <div className="ts-section">
                  <h3>{proximo.status === "en_vivo" ? "Jugando ahora" : "Próximo partido"}</h3>
                  <div className="ts-next">
                    <span className="ts-vs">vs.</span>
                    <Shield className="mini-shield" fill={proximo.rival.shieldColor} />
                    <span className="ts-next-name">{proximo.rival.name}</span>
                    <Marcador m={proximo} />
                  </div>
                  <p className="ts-sub">
                    {proximo.roundLabel}
                    {proximo.court && ` · ${proximo.court}`}
                  </p>
                </div>
              )}

              {detail.players.some((p) => p.goals > 0) && (
                <div className="ts-section">
                  <h3>Goleadores</h3>
                  {detail.players
                    .filter((p) => p.goals > 0)
                    .slice(0, 3)
                    .map((p) => (
                      <div className="ts-scorer" key={p.id}>
                        <span className="ts-num tnum">{p.number ?? "–"}</span>
                        <span className="ts-scorer-name">{p.name}</span>
                        <b className="tnum">{p.goals}</b>
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : vista === "partidos" ? (
            detail.matches.length === 0 ? (
              <p className="empty-note">Todavía no tiene partidos programados.</p>
            ) : (
              <ul className="ts-matches">
                {detail.matches.map((m) => (
                  <li key={m.id} className="ts-match">
                    <span className={`ts-res ${m.result ?? (m.status === "en_vivo" ? "live" : "next")}`}>
                      {m.result ?? (m.status === "en_vivo" ? "●" : "·")}
                    </span>
                    <div className="ts-match-main">
                      <span className="ts-match-rival">
                        <Shield className="mini-shield" fill={m.rival.shieldColor} />
                        {m.rival.name}
                      </span>
                      <span className="ts-sub">
                        {m.roundLabel}
                        {m.status !== "programado" && m.when && ` · ${m.when}`}
                        {m.court && ` · ${m.court}`}
                      </span>
                    </div>
                    <Marcador m={m} />
                  </li>
                ))}
              </ul>
            )
          ) : detail.players.length === 0 ? (
            <p className="empty-note">Este equipo todavía no tiene jugadores cargados.</p>
          ) : (
            <table className="ts-roster">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th title={labels.anota}>{detail.sport === "futbol" ? "G" : "Pts"}</th>
                  <th title="Amarillas">
                    <i className="tcard y" />
                  </th>
                  <th title="Rojas">
                    <i className="tcard r" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.players.map((p) => (
                  <tr key={p.id}>
                    <td className="tnum ts-num">{p.number ?? "–"}</td>
                    <td>
                      <span className="ts-player">{p.name}</span>
                      {p.position && <span className="ts-sub">{p.position}</span>}
                    </td>
                    <td className="tnum">{p.goals || "–"}</td>
                    <td className="tnum">{p.amarillas || "–"}</td>
                    <td className="tnum">{p.rojas || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
