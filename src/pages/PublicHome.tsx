import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { BracketMatch, Branch, HistorialMatch, LiveMatch, Sport, Team, ZoneStandings } from "@/types";
import { getMockAllLiveMatches, getMockData } from "@/lib/mock-data";
import { fetchAllLiveMatches, fetchPublicData, type PublicData } from "@/lib/public-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { DynamicIsland } from "@/components/DynamicIsland";
import { Segmented } from "@/components/Segmented";
import { TeamSheet, type TeamRef } from "@/components/TeamSheet";
import {
  IconBasquet,
  IconBracket,
  IconFollow,
  IconFutbol,
  IconHome,
  IconMoon,
  IconSun,
  IconTable,
  IconVoley,
  Shield
} from "@/components/icons";

const SPORTS: { id: Sport; label: string; icon: typeof IconFutbol }[] = [
  { id: "futbol", label: "Fútbol", icon: IconFutbol },
  { id: "voley", label: "Vóley", icon: IconVoley },
  { id: "basquet", label: "Básquet", icon: IconBasquet }
];

const PESTANAS = [
  { id: "inicio", label: "Inicio", icon: IconHome },
  { id: "tabla", label: "Tabla", icon: IconTable },
  { id: "cruces", label: "Cruces", icon: IconBracket },
  { id: "historial", label: "Historial", icon: IconFollow }
] as const;

const EMPTY: PublicData = { zones: [], bracket: [], historial: [] };

type Pestana = (typeof PESTANAS)[number]["id"];

function temaInicial(): "light" | "dark" | null {
  try {
    const t = localStorage.getItem("bosco-theme");
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function PublicHome() {
  const [sport, setSport] = useState<Sport>("futbol");
  const [branch, setBranch] = useState<Branch>("masculino");
  const [theme, setTheme] = useState<"light" | "dark" | null>(temaInicial);
  const [data, setData] = useState<PublicData>(EMPTY);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [pestana, setPestana] = useState<Pestana>("inicio");
  const [equipo, setEquipo] = useState<TeamRef | null>(null);

  const hasBranches = sport !== "basquet";
  const ramaActual: Branch = hasBranches ? branch : "masculino";

  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
  }, [theme]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isSupabaseConfigured) {
        setData(getMockData(sport, branch));
        setLiveMatches(getMockAllLiveMatches());
        return;
      }
      const [d, live] = await Promise.all([fetchPublicData(sport, branch), fetchAllLiveMatches()]);
      if (active) {
        setData(d);
        setLiveMatches(live);
      }
    }

    load();
    const client = supabase;
    if (!client) return () => { active = false; };

    const channel = client
      .channel(`public-${sport}-${branch}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partidos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos_partido" }, load)
      .subscribe();

    return () => {
      active = false;
      client.removeChannel(channel);
    };
  }, [sport, branch]);

  function toggleTheme() {
    const actual = theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = actual === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("bosco-theme", next);
    } catch {
      /* sin almacenamiento: el tema dura lo que dure la pestaña */
    }
  }

  function irA(destino: Pestana) {
    setPestana(destino);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const abrirEquipo = (team: Team) => setEquipo({ team, sport, branch: ramaActual });
  const abrirDesdeVivo = (team: Team, m: LiveMatch) => setEquipo({ team, sport: m.sport, branch: m.branch });
  const tabIndex = PESTANAS.findIndex((p) => p.id === pestana);
  const sportColor = `var(--color-${sport})`;

  return (
    <div className="pub" style={{ "--sport": sportColor } as CSSProperties}>
      <DynamicIsland matches={liveMatches} onTeam={abrirDesdeVivo} />

      <header className="pub-head">
        <h1 className="pub-title">
          Bosco<span>Cup</span>
        </h1>
        <button className="icon-btn" type="button" aria-label="Cambiar tema claro/oscuro" onClick={toggleTheme}>
          <IconMoon className="only-light" />
          <IconSun className="only-dark" />
        </button>
      </header>

      <div className="pub-controls">
        <Segmented
          label="Deporte"
          value={sport}
          onChange={setSport}
          accent={sportColor}
          options={SPORTS.map(({ id, label, icon: Icon }) => ({
            id,
            label: (
              <>
                <Icon className="seg-icon" />
                {label}
              </>
            )
          }))}
        />
        {hasBranches && (
          <Segmented
            label="Rama"
            size="sm"
            value={branch}
            onChange={setBranch}
            options={[
              { id: "masculino", label: "Masculino" },
              { id: "femenino", label: "Femenino" }
            ]}
          />
        )}
      </div>

      <main className="pub-main" key={pestana}>
        {pestana === "inicio" && (
          <>
            {liveMatches.length > 0 && <LiveRail matches={liveMatches} onTeam={abrirDesdeVivo} />}
            <div className="pub-grid">
              <section className="card">
                <SectionHead title="Tabla" action={() => irA("tabla")} />
                <Standings zones={data.zones} compact onTeam={abrirEquipo} />
              </section>
              <section className="card">
                <SectionHead title="Cruces" action={() => irA("cruces")} />
                <Bracket matches={data.bracket} onTeam={abrirEquipo} />
              </section>
            </div>
          </>
        )}

        {pestana === "tabla" && (
          <section className="card">
            <SectionHead title="Tabla de posiciones" />
            <Standings zones={data.zones} onTeam={abrirEquipo} />
            <p className="legend">
              <span className="legend-q" /> Clasifica a cruces · Tocá un equipo para ver su ficha
            </p>
          </section>
        )}

        {pestana === "cruces" && (
          <section className="card">
            <SectionHead title="Cruces" />
            <Bracket matches={data.bracket} onTeam={abrirEquipo} />
          </section>
        )}

        {pestana === "historial" && (
          <section className="card">
            <SectionHead title="Resultados" />
            <Historial matches={data.historial} onTeam={abrirEquipo} />
          </section>
        )}

        <footer className="role-footer">
          <Link to="/admin/login">Soy organizador</Link>
          <span aria-hidden="true">·</span>
          <Link to="/veedor/login">Soy veedor</Link>
        </footer>
      </main>

      <nav className="tabbar" aria-label="Secciones" style={{ "--n": PESTANAS.length, "--i": tabIndex } as CSSProperties}>
        <span className="tabbar-thumb" aria-hidden="true" />
        {PESTANAS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={pestana === id ? "active" : ""} aria-current={pestana === id ? "page" : undefined} onClick={() => irA(id)}>
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <TeamSheet target={equipo} onClose={() => setEquipo(null)} />
    </div>
  );
}

function SectionHead({ title, action }: { title: string; action?: () => void }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action && (
        <button type="button" className="link-btn" onClick={action}>
          Ver todo
        </button>
      )}
    </div>
  );
}

function TeamName({ team, onTeam, strong }: { team: Team; onTeam: (t: Team) => void; strong?: boolean }) {
  return (
    <button
      type="button"
      className={`team-btn ${strong ? "strong" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onTeam(team);
      }}
    >
      <Shield className="mini-shield" fill={team.shieldColor} />
      <span>{team.name}</span>
    </button>
  );
}

function LiveRail({ matches, onTeam }: { matches: LiveMatch[]; onTeam: (t: Team, m: LiveMatch) => void }) {
  return (
    <section className="live-section">
      <div className="section-head bare">
        <h2>
          <span className="live-dot" /> En vivo
        </h2>
      </div>
      <div className="live-rail">
        {matches.map((m) => (
          <article className="live-card" key={m.id} style={{ "--sport": `var(--color-${m.sport})` } as CSSProperties}>
            <div className="live-card-top">
              <span className="live-chip">{m.statusLabel}</span>
              <span className="live-meta">
                {m.ramaLabel}
                {m.court && ` · ${m.court}`}
              </span>
            </div>
            {[
              [m.home, m.homeScore, m.awayScore],
              [m.away, m.awayScore, m.homeScore]
            ].map(([team, sc, other]) => (
              <div className="live-row" key={(team as Team).id}>
                <TeamName team={team as Team} onTeam={(t) => onTeam(t, m)} strong={(sc as number) > (other as number)} />
                <span className="score tnum">{sc as number}</span>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function Standings({ zones, compact, onTeam }: { zones: ZoneStandings[]; compact?: boolean; onTeam: (t: Team) => void }) {
  if (zones.every((z) => z.rows.length === 0)) {
    return <p className="empty-note">Todavía no hay equipos cargados en esta categoría.</p>;
  }
  return (
    <div className="zones">
      {zones.map((zone) => {
        const empatados = zone.completa ? zone.rows.filter((r) => r.empatado) : [];
        return (
          <div className="zone" key={zone.id}>
            {zone.nombre && <div className="zone-name">{zone.nombre}</div>}
            <div className="table-wrap">
              <table className={`standings ${compact ? "compact" : ""}`}>
                <thead>
                  <tr>
                    <th className="pos">#</th>
                    <th className="team">Equipo</th>
                    <th>PJ</th>
                    {!compact && (
                      <>
                        <th>G</th>
                        <th>E</th>
                        <th>P</th>
                        <th className="wide">GF</th>
                        <th className="wide">GC</th>
                      </>
                    )}
                    <th>DG</th>
                    {!compact && (
                      <>
                        <th className="wide" title="Amarillas">
                          <i className="tcard y" />
                        </th>
                        <th className="wide" title="Rojas">
                          <i className="tcard r" />
                        </th>
                      </>
                    )}
                    <th className="pts">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {zone.rows.map((row) => (
                    <tr className={row.qualifies ? "q" : ""} key={row.team.id} onClick={() => onTeam(row.team)}>
                      <td className="pos tnum">
                        <span>{row.position}</span>
                      </td>
                      <td className="team">
                        <TeamName team={row.team} onTeam={onTeam} />
                      </td>
                      <td className="tnum">{row.played}</td>
                      {!compact && (
                        <>
                          <td className="tnum">{row.won}</td>
                          <td className="tnum">{row.drawn}</td>
                          <td className="tnum">{row.lost}</td>
                          <td className="tnum wide">{row.goalsFor}</td>
                          <td className="tnum wide">{row.goalsAgainst}</td>
                        </>
                      )}
                      <td className="tnum">
                        {row.goalDiff > 0 ? "+" : ""}
                        {row.goalDiff}
                      </td>
                      {!compact && (
                        <>
                          <td className="tnum wide">{row.amarillas}</td>
                          <td className="tnum wide">{row.rojas}</td>
                        </>
                      )}
                      <td className="pts tnum">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {empatados.length > 0 && (
              <p className="notice">
                Empate total entre {empatados.map((r) => r.team.name).join(" y ")}: se define con un partido de desempate.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Bracket({ matches, onTeam }: { matches: BracketMatch[]; onTeam: (t: Team) => void }) {
  if (matches.length === 0) return <p className="empty-note">Los cruces aparecen cuando termina la fase de grupos.</p>;
  const rondas = Array.from(new Set(matches.map((m) => m.round)));
  return (
    <div className="rounds">
      {rondas.map((ronda) => (
        <div className="round" key={ronda}>
          <div className="zone-name">{ronda}</div>
          {matches
            .filter((m) => m.round === ronda)
            .map((m, i) => {
              const penales = m.penalesHome !== null && m.penalesAway !== null;
              const empatadoSinDefinir = !m.pending && m.homeScore === m.awayScore && !penales;
              return (
                <div className={`duel ${m.pending ? "pending" : ""}`} key={`${ronda}-${i}`}>
                  {[
                    [m.home, m.homeScore, m.penalesHome],
                    [m.away, m.awayScore, m.penalesAway]
                  ].map(([team, sc, pen], k) => (
                    <div className={`duel-row ${team && m.winnerId === (team as Team).id ? "win" : ""}`} key={k}>
                      {team ? <TeamName team={team as Team} onTeam={onTeam} strong={m.winnerId === (team as Team).id} /> : <span className="tbd">A definir</span>}
                      {!m.pending && (
                        <span className="score tnum">
                          {sc as number}
                          {penales && <small>({pen as number})</small>}
                        </span>
                      )}
                    </div>
                  ))}
                  {m.pending && <span className="duel-time">{m.scheduledTime ?? "Horario a definir"}</span>}
                  {empatadoSinDefinir && <p className="notice">Empate: falta definir por penales.</p>}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

function Historial({ matches, onTeam }: { matches: HistorialMatch[]; onTeam: (t: Team) => void }) {
  if (matches.length === 0) return <p className="empty-note">Acá van a aparecer los partidos a medida que terminen.</p>;
  return (
    <div className="history">
      {matches.map((m) => {
        const penales = m.penalesHome !== null && m.penalesAway !== null;
        const homeGana = m.homeScore !== m.awayScore ? m.homeScore > m.awayScore : penales && (m.penalesHome as number) > (m.penalesAway as number);
        const awayGana = m.homeScore !== m.awayScore ? m.awayScore > m.homeScore : penales && (m.penalesAway as number) > (m.penalesHome as number);
        return (
          <div className="duel" key={m.id}>
            <div className="duel-meta">
              {m.roundLabel}
              {m.date && ` · ${m.date}`}
              {penales && " · por penales"}
            </div>
            <div className={`duel-row ${homeGana ? "win" : ""}`}>
              <TeamName team={m.home} onTeam={onTeam} strong={homeGana} />
              <span className="score tnum">
                {m.homeScore}
                {penales && <small>({m.penalesHome})</small>}
              </span>
            </div>
            <div className={`duel-row ${awayGana ? "win" : ""}`}>
              <TeamName team={m.away} onTeam={onTeam} strong={awayGana} />
              <span className="score tnum">
                {m.awayScore}
                {penales && <small>({m.penalesAway})</small>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
