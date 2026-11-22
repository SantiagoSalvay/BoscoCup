import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCapa } from "@/lib/historial";
import type { Branch, HistorialMatch, HorarioMatch, LiveMatch, Sport, Team, ZoneStandings } from "@/types";
import { getMockAllLiveMatches, getMockData } from "@/lib/mock-data";
import { fetchAllLiveMatches, fetchHorarios, fetchPublicData, type PublicData } from "@/lib/public-data";
import { TABLAS_ESTATICAS, invalidarTabla, invalidarTodo, type TablaEstatica } from "@/lib/static-cache";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { DynamicIsland } from "@/components/DynamicIsland";
import { Segmented } from "@/components/Segmented";
import { BracketView } from "@/components/BracketView";
import { MapaCanchas } from "@/components/MapaCanchas";
import { PodioTabla } from "@/components/PodioTabla";
import { TeamSheet, type TeamRef } from "@/components/TeamSheet";
import {
  IconAccess,
  IconBracket,
  IconClipboard,
  IconClock,
  IconFollow,
  IconFutbol,
  IconHome,
  IconMoon,
  IconSun,
  IconTable,
  IconVoley,
  IconWhistle,
  Shield
} from "@/components/icons";

const SPORTS: { id: Sport; label: string; icon: typeof IconFutbol }[] = [
  { id: "futbol", label: "Fútbol", icon: IconFutbol },
  { id: "voley", label: "Vóley mixto", icon: IconVoley }
];

const PESTANAS = [
  { id: "inicio", label: "Inicio", icon: IconHome },
  { id: "horarios", label: "Horarios", icon: IconClock },
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
  // Deporte, rama y pestaña viven en la URL (?deporte=voley&seccion=cruces):
  // cada cambio es una entrada del historial, así "atrás" vuelve a la vista
  // anterior en vez de salir de la página.
  const [params, setParams] = useSearchParams();
  const sport: Sport = params.get("deporte") === "voley" ? "voley" : "futbol";
  const branch: Branch = params.get("rama") === "femenino" ? "femenino" : "masculino";
  // Fútbol femenino es liguilla (ida y vuelta) y el vóley juega todos contra
  // todos: ninguno de los dos tiene cruces, el campeón sale de la tabla.
  const liguillaFemenino = sport === "futbol" && branch === "femenino";
  const sinCuadro = liguillaFemenino || sport === "voley";
  const pestanas = sinCuadro ? PESTANAS.filter((p) => p.id !== "cruces") : PESTANAS;
  const pestana: Pestana = pestanas.find((p) => p.id === params.get("seccion"))?.id ?? "inicio";
  function cambiarVista(cambios: { deporte?: Sport; rama?: Branch; seccion?: Pestana }) {
    const next = new URLSearchParams(params);
    const poner = (clave: string, valor: string | undefined, porDefecto: string) => {
      if (valor === undefined) return;
      if (valor === porDefecto) next.delete(clave);
      else next.set(clave, valor);
    };
    poner("deporte", cambios.deporte, "futbol");
    poner("rama", cambios.rama, "masculino");
    poner("seccion", cambios.seccion, "inicio");
    if (next.toString() !== params.toString()) setParams(next);
  }
  const setSport = (deporte: Sport) => cambiarVista({ deporte });
  const setBranch = (rama: Branch) => cambiarVista({ rama });
  const [theme, setTheme] = useState<"light" | "dark" | null>(temaInicial);
  const [data, setData] = useState<PublicData>(EMPTY);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [horarios, setHorarios] = useState<HorarioMatch[] | null>(null);
  const [equipo, setEquipo] = useState<TeamRef | null>(null);
  const capaEquipo = useCapa("equipo");
  const capaAcceso = useCapa("acceso");

  // Solo fútbol tiene ramas; vóley se juega mixto.
  const hasBranches = sport === "futbol";
  const ramaActual: Branch = hasBranches ? branch : "mixto";

  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
  }, [theme]);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setData(getMockData(sport, ramaActual));
      setLiveMatches(getMockAllLiveMatches());
      setHorarios([]);
      return () => { active = false; };
    }
    const client = supabase;
    if (!client) return () => { active = false; };

    // Cada pedido lleva un número; si llega una respuesta vieja después de una
    // nueva, se descarta en vez de pisar datos más frescos.
    let seqPublico = 0;
    let seqVivo = 0;
    let seqHorarios = 0;
    let categoriaId: string | undefined;
    let idsEnVivo = new Set<string>();

    async function cargarPublico() {
      const seq = ++seqPublico;
      const d = await fetchPublicData(sport, ramaActual);
      if (!active || seq !== seqPublico) return;
      categoriaId = d.categoriaId;
      setData(d);
    }

    async function cargarVivo() {
      const seq = ++seqVivo;
      const live = await fetchAllLiveMatches();
      if (!active || seq !== seqVivo) return;
      idsEnVivo = new Set(live.map((m) => m.id));
      setLiveMatches(live);
    }

    async function cargarHorarios() {
      const seq = ++seqHorarios;
      const h = await fetchHorarios();
      if (!active || seq !== seqHorarios) return;
      setHorarios(h);
    }

    // Los eventos realtime se juntan: durante un partido llegan varios seguidos
    // y todos los espectadores los reciben a la vez. Se espera un poco (con una
    // demora al azar para no pegarle a la base todos juntos) y se refresca solo
    // lo que pudo haber cambiado.
    let pendientePublico = false;
    let pendienteVivo = false;
    let pendienteHorarios = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function programar(publico: boolean, vivo: boolean, horarios = false) {
      pendientePublico ||= publico;
      pendienteVivo ||= vivo;
      pendienteHorarios ||= horarios;
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (pendientePublico) void cargarPublico();
        if (pendienteVivo) void cargarVivo();
        if (pendienteHorarios) void cargarHorarios();
        pendientePublico = pendienteVivo = pendienteHorarios = false;
      }, 300 + Math.random() * 400);
    }

    void cargarPublico();
    void cargarVivo();
    void cargarHorarios();

    type Fila = Record<string, unknown> | undefined;
    const filaDe = (payload: { new: unknown; old: unknown }) => ({
      nueva: (payload.new && Object.keys(payload.new as object).length ? payload.new : undefined) as Fila,
      vieja: (payload.old && Object.keys(payload.old as object).length ? payload.old : undefined) as Fila
    });

    function onPartido(payload: { new: unknown; old: unknown }) {
      const { nueva, vieja } = filaDe(payload);
      const id = (nueva?.id ?? vieja?.id) as string | undefined;
      const estado = nueva?.estado as string | undefined;
      const cat = (nueva?.categoria_id ?? vieja?.categoria_id) as string | undefined;
      // Tabla/cruces: solo si el partido es de la categoría que se está viendo
      // (en un DELETE puede no venir la categoría: por las dudas, se refresca).
      const publico = !cat || !categoriaId || cat === categoriaId;
      // Carrusel en vivo: si el partido está o estaba en juego.
      const vivo = !id || idsEnVivo.has(id) || estado === "en_juego" || estado === "entretiempo";
      // Horarios muestra todas las categorías: cualquier cambio de partido cuenta.
      programar(publico, vivo, true);
    }

    function onEvento() {
      // La tabla y el cuadro son en vivo: un gol o una tarjeta en un partido en
      // juego ya mueve las posiciones, así que siempre se refresca todo.
      programar(true, true, true);
    }

    function onEstatica(tabla: TablaEstatica) {
      invalidarTabla(tabla);
      programar(true, true, true);
    }

    // Con el celular bloqueado o la pestaña en segundo plano se pueden perder
    // eventos realtime: al volver se descarta la caché y se recarga todo.
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      invalidarTodo();
      programar(true, true, true);
    }
    document.addEventListener("visibilitychange", onVisible);

    let channel = client
      .channel(`public-${sport}-${ramaActual}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partidos" }, onPartido)
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos_partido" }, onEvento);
    for (const tabla of TABLAS_ESTATICAS) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: tabla }, () => onEstatica(tabla));
    }
    channel.subscribe();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      client.removeChannel(channel);
    };
  }, [sport, ramaActual]);

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
    cambiarVista({ seccion: destino });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function mostrarEquipo(ref: TeamRef) {
    setEquipo(ref);
    capaEquipo.abrir();
  }
  const abrirEquipo = (team: Team) => mostrarEquipo({ team, sport, branch: ramaActual });
  const abrirDesdeVivo = (team: Team, m: LiveMatch) => mostrarEquipo({ team, sport: m.sport, branch: m.branch });
  const tabIndex = pestanas.findIndex((p) => p.id === pestana);
  const sportColor = `var(--color-${sport})`;

  return (
    <div className="pub" style={{ "--sport": sportColor } as CSSProperties}>
      <DynamicIsland matches={liveMatches} onTeam={abrirDesdeVivo} />

      <header className="pub-head">
        <div className="brand">
          <img className="brand-logo only-light" src="/logo-bosco-cup.png" alt="" width={38} height={64} />
          <img className="brand-logo only-dark" src="/logo-bosco-cup-dark.png" alt="" width={38} height={64} />
          <div>
            <h1 className="pub-title">
              Bosco<span>Cup</span>
            </h1>
            <p className="brand-sub">Fútbol · Vóley</p>
          </div>
        </div>
        <div className="head-actions">
          <button className="icon-btn" type="button" aria-label="Cambiar tema claro/oscuro" onClick={toggleTheme}>
            <IconMoon className="only-light" />
            <IconSun className="only-dark" />
          </button>
          <BotonAcceso onClick={capaAcceso.abrir} />
        </div>
      </header>
      <div className="brand-rule" aria-hidden="true" />

      {/* Horarios muestra todo el torneo y tiene su propio filtro. */}
      {pestana !== "horarios" && <div className="pub-controls">
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
      </div>}

      <main className="pub-main" key={pestana}>
        {pestana === "horarios" && (
          <section className="card">
            <SectionHead title="Horarios" />
            <Horarios matches={horarios} onTeam={(team, m) => mostrarEquipo({ team, sport: m.sport, branch: m.branch })} />
          </section>
        )}

        {pestana === "inicio" && (
          <>
            {liveMatches.length > 0 && <LiveRail matches={liveMatches} onTeam={abrirDesdeVivo} />}
            <div className="pub-grid">
              <section className="card">
                <SectionHead title={liguillaFemenino ? "Liguilla" : "Tabla"} action={() => irA("tabla")} />
                <Standings zones={data.zones} compact liguilla={sinCuadro} onTeam={abrirEquipo} />
              </section>
              {sinCuadro && (
                <section className="card">
                  <SectionHead title={liguillaFemenino ? "Campeona" : "Campeón"} />
                  <PodioTabla zones={data.zones} femenino={liguillaFemenino} onTeam={abrirEquipo} />
                </section>
              )}
              {!sinCuadro && (
                <section className="card">
                  <SectionHead title="Cruces" action={() => irA("cruces")} />
                  <BracketView matches={data.bracket} onTeam={abrirEquipo} />
                </section>
              )}
            </div>
          </>
        )}

        {pestana === "tabla" && (
          <section className="card">
            <SectionHead title={liguillaFemenino ? "Liguilla" : "Tabla de posiciones"} />
            {sinCuadro && <PodioTabla zones={data.zones} femenino={liguillaFemenino} onTeam={abrirEquipo} />}
            <Standings zones={data.zones} liguilla={sinCuadro} onTeam={abrirEquipo} />
            <p className="legend">
              {liguillaFemenino && "Ida y vuelta: la que más puntos suma es campeona · "}
              {sport === "voley" && "Todos contra todos: el que más puntos suma es campeón · "}
              {data.zones.some((z) => z.rows.some((r) => r.qualifies)) && (
                <>
                  <span className="legend-q" /> Clasifica a cruces ·{" "}
                </>
              )}
              {liveMatches.length > 0 && "Los partidos en juego ya suman con el marcador del momento · "}
              Tocá un equipo para ver su ficha
            </p>
          </section>
        )}

        {pestana === "cruces" && !sinCuadro && (
          <section className="card">
            <SectionHead title="Cruces" />
            <BracketView matches={data.bracket} onTeam={abrirEquipo} />
          </section>
        )}

        {pestana === "historial" && (
          <section className="card">
            <SectionHead title="Resultados" />
            <Historial matches={data.historial} onTeam={abrirEquipo} />
          </section>
        )}
      </main>

      <nav className="tabbar" aria-label="Secciones" style={{ "--n": pestanas.length, "--i": tabIndex } as CSSProperties}>
        <span className="tabbar-thumb" aria-hidden="true" />
        {pestanas.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={pestana === id ? "active" : ""} aria-current={pestana === id ? "page" : undefined} onClick={() => irA(id)}>
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Con "atrás" la capa se cierra sola (deja de estar abierta en el historial). */}
      <TeamSheet
        target={capaEquipo.abierta ? equipo : null}
        onClose={() => {
          setEquipo(null);
          capaEquipo.cerrar();
        }}
      />
      {capaAcceso.abierta && <HojaAcceso onClose={capaAcceso.cerrar} />}
    </div>
  );
}

/**
 * Botón con el logo del batallón organizador. Si todavía no se subió
 * public/logo-batallon.png, muestra un ícono genérico de acceso.
 */
function BotonAcceso({ onClick }: { onClick: () => void }) {
  const [sinLogo, setSinLogo] = useState(false);
  return (
    <button className="org-btn" type="button" aria-label="Acceso para organizadores y veedores" onClick={onClick}>
      {sinLogo ? <IconAccess /> : <img src="/logo-batallon.png" alt="" onError={() => setSinLogo(true)} />}
    </button>
  );
}

function HojaAcceso({ onClose }: { onClose: () => void }) {
  const [esStaff, setEsStaff] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet access-sheet" role="dialog" aria-modal="true" aria-labelledby="acceso-titulo" onClick={(e) => e.stopPropagation()}>
        {!esStaff ? (
          <>
            <div className="sheet-title" id="acceso-titulo">
              Aviso
            </div>
            <p className="access-intro">
              Este panel es solamente para agentes de la organización. Si sos un usuario común o un jugador, por favor volvé
              atrás: no hace falta que inicies sesión.
            </p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setEsStaff(true)}>
              Soy parte del staff
            </button>
          </>
        ) : (
          <>
            <div className="sheet-title" id="acceso-titulo">
              Acceso del staff
            </div>
            <Link className="access-option" to="/veedor/login" replace>
              <span className="access-ico">
                <IconWhistle />
              </span>
              <div>
                <strong>Soy veedor</strong>
                <span>Cargás goles y tarjetas de los partidos que te asignaron. Entrás con tu PIN de 6 dígitos.</span>
              </div>
              <span className="access-arrow" aria-hidden="true">
                →
              </span>
            </Link>

            <Link className="access-option org" to="/admin/login" replace>
              <span className="access-ico">
                <IconClipboard />
              </span>
              <div>
                <strong>Soy organizador</strong>
                <span>Equipos, jugadores, fixture, canchas, horarios y veedores. Entrás con tu email y contraseña.</span>
              </div>
              <span className="access-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 14, width: "100%" }} onClick={onClose}>
          Volver
        </button>
      </div>
    </div>
  );
}

const FILTROS_HORARIO: { id: string; label: string; incluye: (m: HorarioMatch) => boolean }[] = [
  { id: "todos", label: "Todos", incluye: () => true },
  { id: "futbol-masculino", label: "Fútbol masc.", incluye: (m) => m.sport === "futbol" && m.branch === "masculino" },
  { id: "futbol-femenino", label: "Fútbol fem.", incluye: (m) => m.sport === "futbol" && m.branch === "femenino" },
  { id: "voley", label: "Vóley", incluye: (m) => m.sport === "voley" }
];

const horaCorta = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Grilla de horarios de todo el torneo, agrupada por hora de inicio. */
function Horarios({ matches, onTeam }: { matches: HorarioMatch[] | null; onTeam: (t: Team, m: HorarioMatch) => void }) {
  const [filtro, setFiltro] = useState("todos");
  const [cancha, setCancha] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  if (matches === null) return <p className="empty-note">Cargando horarios…</p>;
  const incluye = FILTROS_HORARIO.find((f) => f.id === filtro)?.incluye ?? (() => true);
  const visibles = matches.filter((m) => incluye(m) && (!cancha || m.court === cancha));
  const canchasEnVivo = new Set(matches.filter((m) => m.estado === "en_vivo" && m.court).map((m) => m.court as string));

  function elegirCancha(nombre: string | null) {
    setCancha(nombre);
    // Al elegir una cancha se ven todos sus partidos, sea del deporte que sea.
    if (nombre) {
      setFiltro("todos");
      requestAnimationFrame(() => listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const bloques: { hora: string; partidos: HorarioMatch[] }[] = [];
  for (const m of visibles) {
    // Sin hora fija (vóley): un bloque por cancha, en el orden en que se juegan.
    const hora = m.fecha ? horaCorta(m.fecha) : m.court && m.orden ? `${m.court} · a continuación` : "Sin horario";
    const ultimo = bloques[bloques.length - 1];
    if (ultimo?.hora === hora) ultimo.partidos.push(m);
    else bloques.push({ hora, partidos: [m] });
  }

  return (
    <>
      <p className="mapa-ayuda">Tocá una cancha para ver sus partidos.</p>
      <MapaCanchas seleccionada={cancha} enVivo={canchasEnVivo} onSelect={elegirCancha} />
      <div ref={listaRef} className="hor-lista">
        {cancha ? (
          <div className="mapa-sel">
            <span>
              Partidos en <b>{cancha}</b>
            </span>
            <button type="button" className="link-btn" onClick={() => elegirCancha(null)}>
              Ver todas
            </button>
          </div>
        ) : (
          <div className="hor-filtros" role="group" aria-label="Filtrar por categoría">
            {FILTROS_HORARIO.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip-option ${filtro === f.id ? "active" : ""}`}
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {bloques.length === 0 ? (
        <p className="empty-note">
          Todavía no hay partidos programados{cancha ? " en esta cancha" : filtro !== "todos" ? " en esta categoría" : ""}.
        </p>
      ) : (
        bloques.map((b) => (
          <div className="hor-bloque" key={b.hora}>
            <div className="hor-hora tnum">{b.hora}</div>
            {b.partidos.map((m) => {
              const conMarcador = m.homeScore !== null && m.awayScore !== null;
              const penales = m.penalesHome !== null && m.penalesAway !== null;
              const homeGana = m.estado === "finalizado" && conMarcador && ((m.homeScore as number) > (m.awayScore as number) || (penales && (m.penalesHome as number) > (m.penalesAway as number)));
              const awayGana = m.estado === "finalizado" && conMarcador && ((m.awayScore as number) > (m.homeScore as number) || (penales && (m.penalesAway as number) > (m.penalesHome as number)));
              return (
                <div className={`duel hor-partido ${m.estado === "finalizado" ? "" : "pending"}`} key={m.id} style={{ "--sport": `var(--color-${m.sport})` } as CSSProperties}>
                  <div className="duel-meta hor-meta">
                    <span className="hor-cancha">
                      {m.court ?? "Cancha a definir"}
                      {m.orden && ` · ${m.orden}º partido`}
                    </span>
                    <span>
                      {m.categoriaLabel} · {m.roundLabel}
                    </span>
                    {m.estado === "en_vivo" && (
                      <span className="hor-estado vivo">
                        <span className="live-dot" /> En vivo
                      </span>
                    )}
                    {m.estado === "finalizado" && <span className="hor-estado">Final</span>}
                    {m.estado === "suspendido" && <span className="hor-estado">Suspendido</span>}
                  </div>
                  <div className={`duel-row ${homeGana ? "win" : ""}`}>
                    <TeamName team={m.home} onTeam={(t) => onTeam(t, m)} strong={homeGana} />
                    {conMarcador && (
                      <span className="score tnum">
                        {m.homeScore}
                        {penales && <small>({m.penalesHome})</small>}
                      </span>
                    )}
                  </div>
                  <div className={`duel-row ${awayGana ? "win" : ""}`}>
                    {m.away ? <TeamName team={m.away} onTeam={(t) => onTeam(t, m)} strong={awayGana} /> : <span className="tbd">A definir</span>}
                    {conMarcador && (
                      <span className="score tnum">
                        {m.awayScore}
                        {penales && <small>({m.penalesAway})</small>}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </>
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

function Standings({
  zones,
  compact,
  liguilla,
  onTeam
}: {
  zones: ZoneStandings[];
  compact?: boolean;
  /** Sin cuadro de playoff: se resalta al que va primero (el podio va aparte, en `PodioTabla`). */
  liguilla?: boolean;
  onTeam: (t: Team) => void;
}) {
  if (zones.every((z) => z.rows.length === 0)) {
    return <p className="empty-note">Todavía no hay equipos cargados en esta categoría.</p>;
  }
  return (
    <div className="zones">
      {zones.map((zone) => {
        const empatados = zone.completa ? zone.rows.filter((r) => r.empatado) : [];
        // Sin playoff: se resalta al que va primero.
        const lider = liguilla && zone.rows[0]?.played > 0 ? zone.rows[0] : null;
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
                    <tr className={row.qualifies || row === lider ? "q" : ""} key={row.team.id} onClick={() => onTeam(row.team)}>
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
