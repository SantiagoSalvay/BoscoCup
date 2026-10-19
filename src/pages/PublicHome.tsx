import { useEffect, useRef, useState } from "react";
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

const EMPTY: PublicData = { zones: [], bracket: [], historial: [] };

type Theme = "system" | "light" | "dark";
type Pestana = "inicio" | "tabla" | "cruces" | "historial";

export function PublicHome() {
  const [sport, setSport] = useState<Sport>("futbol");
  const [branch, setBranch] = useState<Branch>("masculino");
  const [theme, setTheme] = useState<Theme>("system");
  const [data, setData] = useState<PublicData>(EMPTY);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [pestana, setPestana] = useState<Pestana>("inicio");
  const scrollRef = useRef<HTMLDivElement>(null);
  const tablaRef = useRef<HTMLDivElement>(null);
  const crucesRef = useRef<HTMLDivElement>(null);

  const hasBranches = sport !== "basquet";

  function irA(destino: Pestana) {
    setPestana(destino);
    if (destino === "inicio") scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    if (destino === "tabla") tablaRef.current?.scrollIntoView({ behavior: "smooth" });
    if (destino === "cruces") crucesRef.current?.scrollIntoView({ behavior: "smooth" });
  }

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

      <div className="scroll" ref={scrollRef}>
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

        {pestana === "historial" ? (
          <section className="block">
            <h3>Historial</h3>
            {data.historial.length === 0 ? (
              <p className="empty-note">Todavía no hay partidos finalizados</p>
            ) : (
              data.historial.map((m) => {
                const penales = m.penalesHome !== null && m.penalesAway !== null;
                const homeGana = m.homeScore !== m.awayScore ? m.homeScore > m.awayScore : penales && (m.penalesHome as number) > (m.penalesAway as number);
                const awayGana = m.homeScore !== m.awayScore ? m.awayScore > m.homeScore : penales && (m.penalesAway as number) > (m.penalesHome as number);
                return (
                  <div className="match-pill" key={m.id} style={{ display: "block" }}>
                    <div className="bracket-round" style={{ margin: "0 0 6px" }}>
                      {m.roundLabel} {m.date && `· ${m.date}`}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span className={`side ${homeGana ? "winner" : ""}`}>
                        <Shield className="mini-shield" style={{ width: 12, height: 14 }} fill={m.home.shieldColor} />
                        {m.home.name}
                      </span>
                      <span className="sc tnum">
                        {m.homeScore}
                        {penales && <span style={{ fontSize: 11, marginLeft: 4 }}>({m.penalesHome})</span>}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
                      <span className={`side ${awayGana ? "winner" : ""}`}>
                        <Shield className="mini-shield" style={{ width: 12, height: 14 }} fill={m.away.shieldColor} />
                        {m.away.name}
                      </span>
                      <span className="sc tnum">
                        {m.awayScore}
                        {penales && <span style={{ fontSize: 11, marginLeft: 4 }}>({m.penalesAway})</span>}
                      </span>
                    </div>
                    {penales && <div className="form-hint" style={{ margin: "6px 0 0" }}>Definido por penales</div>}
                  </div>
                );
              })
            )}
          </section>
        ) : (
        <div className="panels">
          <section className="block" ref={tablaRef}>
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
                          <th>TA</th>
                          <th>TR</th>
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
                            <td className="tnum">{row.amarillas}</td>
                            <td className="tnum">{row.rojas}</td>
                            <td className="tnum">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {zone.rows.some((r) => r.empatado) && (
                    <p className="form-hint form-hint-warn" style={{ margin: "6px 0 0" }}>
                      Empate total entre {zone.rows.filter((r) => r.empatado).map((r) => r.team.name).join(" y ")} — hace falta
                      un partido de desempate.
                    </p>
                  )}
                </div>
              ))
            )}
          </section>

          <section className="block" ref={crucesRef}>
            <h3>Cruces</h3>
            {data.bracket.length === 0 && <p className="empty-note">Todavía no hay cruces definidos</p>}
            {data.bracket.map((m, i) => {
              const penales = m.penalesHome !== null && m.penalesAway !== null;
              const empatadoSinDefinir = !m.pending && m.homeScore === m.awayScore && !penales;
              return (
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
                      <span className="sc tnum">
                        {m.homeScore}
                        {penales && <span style={{ fontSize: 11, marginLeft: 4 }}>({m.penalesHome})</span>}
                      </span>
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
                      <span className="sc tnum">
                        {m.awayScore}
                        {penales && <span style={{ fontSize: 11, marginLeft: 4 }}>({m.penalesAway})</span>}
                      </span>
                    </div>
                  )}
                  {empatadoSinDefinir && (
                    <p className="form-hint form-hint-warn" style={{ margin: "2px 0 8px" }}>
                      Empate — falta definir por penales.
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        </div>
        )}

        <div className="role-footer">
          <Link to="/admin/login">Soy organizador</Link>
          <span className="role-footer-sep">·</span>
          <Link to="/veedor/login">Soy veedor</Link>
        </div>
      </div>

      <nav className="bottom-nav">
        <button className={`bn ${pestana === "inicio" ? "active" : ""}`} onClick={() => irA("inicio")}>
          <IconHome />
          Inicio
        </button>
        <button className={`bn ${pestana === "tabla" ? "active" : ""}`} onClick={() => irA("tabla")}>
          <IconTable />
          Tabla
        </button>
        <button className={`bn ${pestana === "cruces" ? "active" : ""}`} onClick={() => irA("cruces")}>
          <IconBracket />
          Cruces
        </button>
        <button className={`bn ${pestana === "historial" ? "active" : ""}`} onClick={() => irA("historial")}>
          <IconFollow />
          Historial
        </button>
      </nav>
    </div>
  );
}
