import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { BracketMatch, Team } from "@/types";
import { Shield } from "@/components/icons";
import { ID_LUGAR_VACIO } from "@/lib/bracket";

const esLugarVacio = (t: Team) => t.id.startsWith(ID_LUGAR_VACIO);

/**
 * Cuadro de playoffs espejado: la mitad izquierda avanza hacia la derecha, la
 * mitad derecha hacia la izquierda, y en el centro la final con el logo de la
 * copa, el campeón arriba y el subcampeón abajo (más el 3er puesto).
 * Sirve para cualquier tamaño de cuadro (2 a 16 equipos), con pases directos.
 */

const PARTIDOS: Record<string, number> = { Octavos: 8, Cuartos: 4, Semifinal: 2, Final: 1 };
const ORDEN = ["Octavos", "Cuartos", "Semifinal", "Final"];
const ETIQUETA: Record<string, string> = { Octavos: "Octavos", Cuartos: "Cuartos", Semifinal: "Semis", Final: "Final" };

export function Trofeo(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M7 4h10v3a5 5 0 0 1-10 0V4Zm10 1h3v1.5A3.5 3.5 0 0 1 16.6 10M7 5H4v1.5A3.5 3.5 0 0 0 7.4 10M12 12v4m-3.5 4h7l-1-4h-5l-1 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface Props {
  matches: BracketMatch[];
  onTeam?: (t: Team) => void;
  /** Contenido extra debajo de cada partido (en el admin: editar cancha y hora). */
  renderExtra?: (m: BracketMatch) => ReactNode;
}

function Equipo({
  team,
  score,
  pen,
  win,
  seed,
  onTeam
}: {
  team: Team | null;
  score: number | null;
  pen: number | null;
  win: boolean;
  seed?: string;
  onTeam?: (t: Team) => void;
}) {
  // Lugar de un grupo que todavía no tiene equipos asignados: se ve como "A definir".
  if (team && esLugarVacio(team)) team = null;
  return (
    <div className={`bk-team ${win ? "win" : ""} ${team ? "" : "tbd"}`}>
      {seed && <span className="bk-seed tnum">{seed}</span>}
      {team ? (
        <button
          type="button"
          className="bk-team-name"
          onClick={(e) => {
            e.stopPropagation();
            onTeam?.(team);
          }}
          disabled={!onTeam}
        >
          <Shield className="mini-shield" fill={team.shieldColor} />
          <span>{team.name}</span>
        </button>
      ) : (
        <span className="bk-team-name">A definir</span>
      )}
      {score !== null && (
        <span className="bk-score tnum">
          {score}
          {pen !== null && <small>({pen})</small>}
        </span>
      )}
    </div>
  );
}

function Tarjeta({ m, onTeam, renderExtra, destacada }: { m: BracketMatch; onTeam?: (t: Team) => void; renderExtra?: Props["renderExtra"]; destacada?: boolean }) {
  const penales = m.penalesHome !== null && m.penalesAway !== null;
  const conMarcador = !m.pending || Boolean(m.enVivo);
  const estado = m.enVivo ? "live" : m.pending ? "pending" : "done";
  return (
    <div className={`bk-match ${estado} ${m.proyectado ? "proj" : ""} ${destacada ? "final" : ""}`}>
      <Equipo
        team={m.home}
        seed={m.seedHome}
        score={conMarcador ? m.homeScore ?? 0 : null}
        pen={penales ? m.penalesHome : null}
        win={m.winnerId === m.home.id}
        onTeam={onTeam}
      />
      <Equipo
        team={m.away}
        seed={m.seedAway}
        score={conMarcador ? m.awayScore ?? 0 : null}
        pen={penales ? m.penalesAway : null}
        win={Boolean(m.away && m.winnerId === m.away.id)}
        onTeam={onTeam}
      />
      {m.enVivo ? (
        <div className="bk-meta live">
          <span className="bk-live-dot" aria-hidden="true" />
          {penales ? "Penales en vivo" : "En vivo"}
          {m.court && ` · ${m.court}`}
        </div>
      ) : m.pending && !m.proyectado ? (
        <div className="bk-meta">
          {m.scheduledTime ?? "Horario a definir"}
          {m.court && ` · ${m.court}`}
        </div>
      ) : null}
      {renderExtra?.(m)}
    </div>
  );
}

function Hueco({ texto }: { texto: string }) {
  return <div className="bk-match ghost">{texto}</div>;
}

export function BracketView({ matches, onTeam, renderExtra }: Props) {
  const scroller = useRef<HTMLDivElement>(null);

  // En pantallas chicas el cuadro se desliza: arranca centrado en la final.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [matches.length]);

  if (matches.length === 0) return <p className="empty-note">El cuadro aparece cuando haya equipos cargados.</p>;

  // Cruces que todavía no existen: se muestran según la tabla del momento.
  const provisorio = matches.some((m) => m.proyectado || m.enVivo);
  const soloProyeccion = matches.every((m) => m.proyectado);
  const sinEquipos = matches.every((m) => esLugarVacio(m.home));

  // Tamaño del cuadro: la ronda más grande que haya.
  const primera = ORDEN.find((r) => matches.some((m) => m.round === r)) ?? "Final";
  const rondas = ORDEN.slice(ORDEN.indexOf(primera));
  const porRonda = new Map<string, Map<number, BracketMatch>>();
  for (const r of [...rondas, "3er puesto"]) {
    const lista = matches.filter((m) => m.round === r);
    porRonda.set(r, new Map(lista.map((m, i) => [m.pos ?? i, m])));
  }

  const laterales = rondas.filter((r) => r !== "Final");
  const filas = Math.max(1, (PARTIDOS[primera] ?? 1) / 2);
  const final = porRonda.get("Final")?.get(0) ?? null;
  const tercero = porRonda.get("3er puesto")?.get(0) ?? null;
  // Con la final en juego, el que va ganando aparece como campeón (provisorio).
  const campeon =
    final && (!final.pending || final.enVivo) && final.winnerId ? (final.winnerId === final.home.id ? final.home : final.away) : null;
  const subcampeon = campeon && final ? (campeon.id === final.home.id ? final.away : final.home) : null;

  const columna = (ronda: string, lado: 0 | 1, idx: number) => {
    const mitad = PARTIDOS[ronda] / 2;
    const posiciones = Array.from({ length: mitad }, (_, k) => k + lado * mitad);
    const esPrimera = idx === 0;
    const slot = (pos: number) => {
      const m = porRonda.get(ronda)?.get(pos);
      // En la primera ronda, un lugar sin partido es un pase directo.
      return (
        <div className={`bk-slot ${esPrimera ? "" : "in"}`} key={pos}>
          {m ? <Tarjeta m={m} onTeam={onTeam} renderExtra={renderExtra} /> : <Hueco texto={esPrimera ? "Pasa directo" : "A definir"} />}
        </div>
      );
    };
    const grupos: number[][] = [];
    for (let k = 0; k < posiciones.length; k += 2) grupos.push(posiciones.slice(k, k + 2));
    return (
      <div className={`bk-col ${lado === 0 ? "left" : "right"}`} key={`${ronda}-${lado}`}>
        <div className="bk-col-head">{ETIQUETA[ronda]}</div>
        <div className="bk-col-body">
          {grupos.map((g) =>
            g.length === 2 ? (
              <div className="bk-pair" key={g[0]}>
                {g.map(slot)}
              </div>
            ) : (
              slot(g[0])
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <>
    {provisorio && (
      <p className="bk-aviso" role="status">
        <span className="bk-live-dot" aria-hidden="true" />
        {sinEquipos
          ? "Cruces según la posición en cada grupo. Los equipos aparecen cuando arranca el primer partido y se actualizan en vivo."
          : soloProyeccion
          ? "Cuadro provisorio: así quedarían los cruces si la fase de grupos terminara ahora. Se actualiza con cada gol."
          : "Provisorio: los partidos en juego cuentan con el marcador del momento."}
      </p>
    )}
    <div className="bk" ref={scroller}>
      <div className="bk-grid" style={{ "--filas": filas } as CSSProperties}>
        {laterales.map((r, i) => columna(r, 0, i))}

        <div className={`bk-col center ${laterales.length ? "" : "solo"}`}>
          <div className="bk-col-head">Final</div>
          <div className="bk-col-body">
            <div className="bk-podio-top">
              <img className="bk-logo only-light" src="/logo-bosco-cup.png" alt="Bosco Cup" />
              <img className="bk-logo only-dark" src="/logo-bosco-cup-dark.png" alt="Bosco Cup" />
              <div className={`bk-champ ${campeon ? "set" : ""} ${campeon && final?.enVivo ? "prov" : ""}`}>
                <Trofeo className="bk-trophy" />
                <span className="bk-champ-label">Campeón</span>
                {campeon ? (
                  <button type="button" className="bk-champ-name" onClick={() => onTeam?.(campeon)} disabled={!onTeam}>
                    <Shield className="mini-shield" fill={campeon.shieldColor} />
                    {campeon.name}
                  </button>
                ) : (
                  <span className="bk-champ-name tbd">A definir</span>
                )}
              </div>
            </div>

            <div className="bk-slot final-slot">
              {final ? <Tarjeta m={final} onTeam={onTeam} renderExtra={renderExtra} destacada /> : <Hueco texto="Final · a definir" />}
            </div>

            <div className="bk-podio-bottom">
              <div className={`bk-runner ${subcampeon ? "set" : ""}`}>
                <span className="bk-runner-label">Subcampeón</span>
                {subcampeon ? (
                  <button type="button" className="bk-runner-name" onClick={() => onTeam?.(subcampeon)} disabled={!onTeam}>
                    <Shield className="mini-shield" fill={subcampeon.shieldColor} />
                    {subcampeon.name}
                  </button>
                ) : (
                  <span className="bk-runner-name tbd">A definir</span>
                )}
              </div>
              {tercero && (
                <div className="bk-third">
                  <span className="bk-third-label">3er puesto</span>
                  <Tarjeta m={tercero} onTeam={onTeam} renderExtra={renderExtra} />
                </div>
              )}
            </div>
          </div>
        </div>

        {[...laterales].reverse().map((r, i) => columna(r, 1, laterales.length - 1 - i))}
      </div>
    </div>
    </>
  );
}
