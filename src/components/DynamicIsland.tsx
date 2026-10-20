import { useEffect, useRef, useState } from "react";
import type { LiveMatch, Sport, Team } from "@/types";
import { IconBasquet, IconFutbol, IconVoley, Shield } from "@/components/icons";

const SPORT_ICON: Record<Sport, typeof IconFutbol> = {
  futbol: IconFutbol,
  voley: IconVoley,
  basquet: IconBasquet
};

/** "Güemes" -> "GÜE": sigla corta para que entre el marcador en la isla compacta. */
function sigla(name: string): string {
  return name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
}

/**
 * Isla dinámica fija arriba de todo: compacta muestra cuántos partidos hay en
 * vivo y va rotando sus marcadores; al tocarla se expande con todos los
 * partidos en juego del torneo.
 */
export function DynamicIsland({ matches, onTeam }: { matches: LiveMatch[]; onTeam: (team: Team, match: LiveMatch) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const n = matches.length;

  useEffect(() => {
    setIndex((i) => (n === 0 ? 0 : i % n));
  }, [n]);

  useEffect(() => {
    if (n <= 1 || expanded) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % n);
      setTick((k) => k + 1);
    }, 4000);
    return () => window.clearInterval(t);
  }, [n, expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [expanded]);

  const current = matches[index];
  const state = expanded ? "expanded" : n > 0 ? "live" : "idle";

  return (
    <>
      <div className={`island-scrim ${expanded ? "show" : ""}`} aria-hidden="true" />
      <div className="island-bar">
        <div className={`island ${state}`} ref={ref}>
          <button
            type="button"
            className="island-compact"
            aria-expanded={expanded}
            aria-label={n > 0 ? `${n} partido(s) en vivo. Ver todos` : "No hay partidos en vivo"}
            onClick={() => setExpanded((v) => !v)}
          >
            <span className={`island-dot ${n > 0 ? "on" : ""}`} />
            <span className="island-count">{n > 0 ? `${n} en vivo` : "Sin partidos en vivo"}</span>
            {current && !expanded && (
              <span className="island-ticker" key={tick}>
                <span className="island-sep" />
                <Shield className="island-shield" fill={current.home.shieldColor} />
                <span className="island-abbr">{sigla(current.home.name)}</span>
                <span className="island-score tnum">
                  {current.homeScore}
                  <i>–</i>
                  {current.awayScore}
                </span>
                <span className="island-abbr">{sigla(current.away.name)}</span>
                <Shield className="island-shield" fill={current.away.shieldColor} />
              </span>
            )}
          </button>

          <div className="island-body" aria-hidden={!expanded}>
            <div className="island-body-inner">
              {n === 0 ? (
                <p className="island-empty">Cuando arranque un partido, el marcador aparece acá al instante.</p>
              ) : (
                matches.map((m) => {
                  const Icon = SPORT_ICON[m.sport];
                  return (
                    <div className="island-match" key={m.id}>
                      <div className="island-match-meta">
                        <Icon />
                        <span>{m.ramaLabel}</span>
                        {m.court && <span>· {m.court}</span>}
                        <span className="island-status">{m.statusLabel}</span>
                      </div>
                      <div className="island-match-row">
                        <button type="button" tabIndex={expanded ? 0 : -1} className="island-team" onClick={() => onTeam(m.home, m)}>
                          <Shield className="island-shield" fill={m.home.shieldColor} />
                          <span>{m.home.name}</span>
                        </button>
                        <span className="island-big tnum">
                          {m.homeScore}
                          <i>–</i>
                          {m.awayScore}
                        </span>
                        <button
                          type="button"
                          tabIndex={expanded ? 0 : -1}
                          className="island-team right"
                          onClick={() => onTeam(m.away, m)}
                        >
                          <span>{m.away.name}</span>
                          <Shield className="island-shield" fill={m.away.shieldColor} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
