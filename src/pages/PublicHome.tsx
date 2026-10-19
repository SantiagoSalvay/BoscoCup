import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Branch, LiveMatch, Sport } from "@/types";
import { getMockAllLiveMatches, getMockData } from "@/lib/mock-data";
import { fetchAllLiveMatches, fetchLiveCount, fetchPublicData, type PublicData } from "@/lib/public-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { LiveCarousel } from "@/components/LiveCarousel";
import {
  IconBasquet,
  IconBracket,
  IconFollow,
  IconFutbol,
  IconHome,
  IconMoon,
  IconStar,
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

const EMPTY: PublicData = { zones: [], bracket: [] };

type Theme = "system" | "light" | "dark";

export function PublicHome() {
  const [sport, setSport] = useState<Sport>("futbol");
  const [branch, setBranch] = useState<Branch>("masculino");
  const [theme, setTheme] = useState<Theme>("system");
  const [data, setData] = useState<PublicData>(EMPTY);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [liveCount, setLiveCount] = useState(0);

  const hasBranches = sport !== "basquet";

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isSupabaseConfigured) {
        setData(getMockData(sport, branch));
        setLiveMatches(getMockAllLiveMatches());
        setLiveCount(getMockAllLiveMatches().length);
        return;
      }
      const [d, live, count] = await Promise.all([fetchPublicData(sport, branch), fetchAllLiveMatches(), fetchLiveCount()]);
      if (active) {
        setData(d);
        setLiveMatches(live);
        setLiveCount(count);
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

  function toggleTheme(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  return (
    <div className="shell">
      <header className="ph-head">
        <div className="wordmark">
          <span className="ball" />
          Bosco<span className="cup">Cup</span>
        </div>
        <div className="head-right">
          <div className="live-count">
            <span className="dot" />
            {liveCount} EN VIVO
          </div>
          <button
            className="theme-btn"
            type="button"
            aria-pressed={theme === "light"}
            aria-label="Tema claro"
            onClick={() => toggleTheme("light")}
          >
            <IconSun />
          </button>
          <button
            className="theme-btn"
            type="button"
            aria-pressed={theme === "dark"}
            aria-label="Tema oscuro"
            onClick={() => toggleTheme("dark")}
          >
            <IconMoon />
          </button>
        </div>
      </header>

      <div className="scroll">
        <LiveCarousel matches={liveMatches} />

        <nav className="sport-tabs">
          {SPORTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`sport-tab ${sport === id ? `active ${id}` : ""}`}
              onClick={() => setSport(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>

        {hasBranches && (
          <div
            className="branch-toggle"
            style={{ "--active-branch-color": `var(--color-${sport})` } as React.CSSProperties}
          >
            <button className={branch === "masculino" ? "active" : ""} onClick={() => setBranch("masculino")}>
              Masculino
            </button>
            <button className={branch === "femenino" ? "active" : ""} onClick={() => setBranch("femenino")}>
              Femenino
            </button>
          </div>
        )}

        <div className="panels">
          <section className="block">
            <h3>Tabla</h3>
            {data.zones.every((z) => z.rows.length === 0) ? (
              <p className="empty-note">Sin equipos cargados todavía</p>
            ) : (
              data.zones.map((zone) => (
                <div key={zone.id} style={{ marginBottom: 16 }}>
                  {zone.nombre && <div className="bracket-round">{zone.nombre}</div>}
                  <div className="table-wrap">
                    <table className="standings">
                      <thead>
                        <tr>
                          <th>Equipo</th>
                          <th>PJ</th>
                          <th>DG</th>
                          <th>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zone.rows.map((row) => (
                          <tr className={row.qualifies ? "win" : ""} key={row.team.id}>
                            <td>
                              <Shield className="mini-shield" fill={row.team.shieldColor} />
                              {row.team.name}
                              {row.qualifies && <IconStar className="star" />}
                            </td>
                            <td className="tnum">{row.played}</td>
                            <td className="tnum">
                              {row.goalDiff > 0 ? "+" : ""}
                              {row.goalDiff}
                            </td>
                            <td className="tnum">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="block">
            <h3>Cruces</h3>
            {data.bracket.length === 0 && <p className="empty-note">Todavía no hay cruces definidos</p>}
            {data.bracket.map((m, i) => (
              <div key={`${m.round}-${i}`}>
                <div className="bracket-round">{m.round}</div>
                <div className={`match-pill ${m.pending ? "pending" : ""}`}>
                  <span className={`side ${m.winnerId === m.home.id ? "winner" : ""}`}>
                    <Shield className="mini-shield" style={{ width: 12, height: 14 }} fill={m.home.shieldColor} />
                    {m.home.name}
                  </span>
                  {m.pending ? (
                    <span className="vs-time">{m.scheduledTime}</span>
                  ) : (
                    <span className="sc tnum">{m.homeScore}</span>
                  )}
                  {m.pending && m.away && (
                    <span className="side">
                      <Shield className="mini-shield" style={{ width: 12, height: 14 }} fill={m.away.shieldColor} />
                      {m.away.name}
                    </span>
                  )}
                </div>
                {!m.pending && m.away && (
                  <div className="match-pill">
                    <span className={`side ${m.winnerId === m.away.id ? "winner" : ""}`}>
                      <Shield className="mini-shield" style={{ width: 12, height: 14 }} fill={m.away.shieldColor} />
                      {m.away.name}
                    </span>
                    <span className="sc tnum">{m.awayScore}</span>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>

        <div className="role-footer">
          <Link to="/admin/login">Soy organizador</Link>
          <span className="role-footer-sep">·</span>
          <Link to="/veedor/login">Soy veedor</Link>
        </div>
      </div>

      <nav className="bottom-nav">
        <button className="bn active">
          <IconHome />
          Inicio
        </button>
        <button className="bn">
          <IconTable />
          Tabla
        </button>
        <button className="bn">
          <IconBracket />
          Cruces
        </button>
        <button className="bn">
          <IconFollow />
          Seguir
        </button>
      </nav>
    </div>
  );
}
